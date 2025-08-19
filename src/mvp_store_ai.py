# src/mvp_store_ai.py
import argparse, json, os, time, math
import cv2
import numpy as np
from ultralytics import YOLO
from dotenv import load_dotenv; load_dotenv()

from db_oracle import init_db, log_event, log_path, upsert_session

def point_in_poly(pt, poly_np):
    return cv2.pointPolygonTest(poly_np, (float(pt[0]), float(pt[1])), False) >= 0

def box_center(xyxy):
    x1,y1,x2,y2 = xyxy
    return (float((x1+x2)/2.0), float((y1+y2)/2.0))

def euclid(a,b):
    return math.hypot(a[0]-b[0], a[1]-b[1])

def clean_poly(points):
    if len(points) >= 2 and tuple(points[0]) == tuple(points[-1]):
        points = points[:-1]
    return np.array(points, dtype=np.int32)

class PersonState:
    def __init__(self, pid):
        self.pid = pid
        self.first_ts = None
        self.last_ts = None
        self.center_hist = []
        self.roi_enter_ts = {}
        self.reach_frames = {}
        self.post_reach_ref = {}
        self.fired = set()
        # Dados coletados para salvar depois
        self.events = []
        self.paths = []
        self.sessions = []
        # Contador de frames para filtrar detecções falsas
        self.frame_count = 0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--rois", default="rois.json")
    ap.add_argument("--camera-id", default="cam01")
    ap.add_argument("--dwell-sec", type=float, default=3.0)
    ap.add_argument("--reach-frames", type=int, default=6)
    ap.add_argument("--depart-px", type=float, default=250.0)
    ap.add_argument("--depart-window", type=float, default=3.0)
    args = ap.parse_args()

    # Carregar ROIs
    with open(args.rois, "r", encoding="utf-8") as f:
        all_rois = json.load(f)
    video_key = os.path.basename(args.video)
    if video_key not in all_rois or not all_rois[video_key]:
        raise ValueError(f"Sem ROIs para {video_key} em {args.rois}")

    rois = []
    for roi in all_rois[video_key]:
        pts = clean_poly(roi["points"])
        if len(pts) >= 3:
            rois.append({"name": roi["name"], "poly": pts})

    print(f"[INFO] {video_key} -> ROIs: {[r['name'] for r in rois]}")

    # Modelo
    model = YOLO("yolov8n-pose.pt")
    cap = cv2.VideoCapture(args.video)

    persons = {}
    WIN = "MVP Store AI (Oracle)"
    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
    
    print("[INFO] Processando vídeo...")

    while True:
        ok, frame = cap.read()
        if not ok: break
        ts = time.time()

        # desenha ROIs
        for r in rois:
            cv2.polylines(frame, [r["poly"]], True, (0,255,255), 2)
            cx, cy = int(np.mean(r["poly"][:,0])), int(np.mean(r["poly"][:,1]))
            cv2.putText(frame, r["name"], (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 3, cv2.LINE_AA)
            cv2.putText(frame, r["name"], (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,255), 2)

        results = model.track(source=frame, stream=True, persist=True, verbose=False, 
                             tracker="bytetrack.yaml", conf=0.5, iou=0.7)
        for r in results:
            boxes = r.boxes
            kps = r.keypoints
            if boxes is None or boxes.id is None:
                cv2.imshow(WIN, frame)
                if cv2.waitKey(1) == 27: break
                continue

            ids = boxes.id.int().cpu().tolist()
            xyxys = boxes.xyxy.cpu().numpy()
            kp_xy = kps.xy.cpu().numpy() if kps is not None else None

            for i, tid in enumerate(ids):
                pid = f"{args.camera_id}_{tid}"
                st = persons.get(pid)
                if st is None:
                    st = PersonState(pid)
                    persons[pid] = st
                    print(f"[INFO] Nova pessoa detectada: {pid}")
                
                st.frame_count += 1
                st.last_ts = ts
                if st.first_ts is None: st.first_ts = ts
                
                # Só registrar eventos após a pessoa ser detectada por pelo menos 10 frames
                if st.frame_count == 10:
                    st.events.append({
                        'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                        'event_type': 'enter_store', 'roi_id': None, 'conf': None, 'extra': None
                    })
                    print(f"[EVENT] {pid} entrou na loja (confirmado após {st.frame_count} frames)")
                
                # Coletar sessão para salvar depois
                st.sessions.append({
                    'ts': ts, 'person_id': pid, 'camera_id': args.camera_id
                })

                c = box_center(xyxys[i])
                in_roi = None
                for rr in rois:
                    if point_in_poly(c, rr["poly"]):
                        in_roi = rr["name"]; break
                
                # Coletar posição para salvar depois
                st.paths.append({
                    'ts': ts, 'person_id': pid, 'x': c[0], 'y': c[1], 
                    'roi_id': in_roi, 'camera_id': args.camera_id
                })

                # Regra 1 - Dwell
                if in_roi:
                    if in_roi not in st.roi_enter_ts:
                        st.roi_enter_ts[in_roi] = ts
                    dwell = ts - st.roi_enter_ts[in_roi]
                    key = f"dwell_low_{in_roi}"
                    if dwell >= args.dwell_sec and key not in st.fired:
                        st.fired.add(key)
                        # Coletar evento para salvar depois
                        st.events.append({
                            'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                            'event_type': 'dwell_low', 'roi_id': in_roi, 'conf': 0.6,
                            'extra': {"dwell_s": round(dwell,2)}
                        })
                        print(f"[EVENT] {pid} ficou {dwell:.1f}s em {in_roi} (LOW)")
                        cv2.putText(frame, f"LOW {pid}@{in_roi}", (int(c[0]), int(c[1]-20)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,255,0), 2)
                else:
                    st.roi_enter_ts = {}

                # Regra 2 - Reach
                if kp_xy is not None and kp_xy.shape[1] >= 11:
                    wrists = [kp_xy[i,9], kp_xy[i,10]]
                    for rr in rois:
                        inside = any(
                            w[0] > 0 and w[1] > 0 and point_in_poly(w, rr["poly"])
                            for w in wrists
                        )
                        st.reach_frames.setdefault(rr["name"], 0)
                        if inside:
                            st.reach_frames[rr["name"]] += 1
                            key = f"reach_med_{rr['name']}"
                            if st.reach_frames[rr["name"]] >= args.reach_frames and key not in st.fired:
                                st.fired.add(key)
                                st.post_reach_ref[rr["name"]] = {"ts": ts, "center": c}
                                # Coletar evento para salvar depois
                                st.events.append({
                                    'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                    'event_type': 'reach_medium', 'roi_id': rr["name"], 'conf': 0.75,
                                    'extra': None
                                })
                                print(f"[EVENT] {pid} alcançou {rr['name']} (MED)")
                                cv2.putText(frame, f"MED {pid}@{rr['name']}", (int(c[0]), int(c[1]-40)),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,165,255), 2)
                        else:
                            st.reach_frames[rr["name"]] = max(0, st.reach_frames.get(rr["name"], 0) - 1)

                # Regra 3 - Depart
                for name, ref in list(st.post_reach_ref.items()):
                    if ts - ref["ts"] <= args.depart_window:
                        if euclid(c, ref["center"]) >= args.depart_px and f"depart_high_{name}" not in st.fired:
                            st.fired.add(f"depart_high_{name}")
                            # Coletar evento para salvar depois
                            st.events.append({
                                'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                'event_type': 'depart_high', 'roi_id': name, 'conf': 0.85,
                                'extra': {"depart_px": int(euclid(c, ref["center"]))}
                            })
                            print(f"[EVENT] {pid} saiu após alcançar {name} (HIGH)")
                            cv2.putText(frame, f"HIGH {pid}", (int(c[0]), int(c[1]-60)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
                    else:
                        st.post_reach_ref.pop(name, None)

                cv2.circle(frame, (int(c[0]), int(c[1])), 4, (255,255,255), -1)
                cv2.putText(frame, pid, (int(c[0])+6, int(c[1])+6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220,220,220), 1)

            cv2.imshow(WIN, frame)
            if cv2.waitKey(1) == 27:
                cap.release(); cv2.destroyAllWindows(); return

    cap.release()
    cv2.destroyAllWindows()
    
    # Salvar todos os dados no banco de uma vez
    print("[INFO] Salvando dados no Oracle Database...")
    try:
        init_db()  # garante schema/tabelas
        
        total_events = 0
        total_paths = 0
        total_sessions = 0
        
        for pid, person in persons.items():
            # Filtrar pessoas que foram detectadas por muito pouco tempo
            if person.frame_count < 30:  # Menos de 30 frames = detecção falsa
                print(f"[INFO] Ignorando {pid} - detectado por apenas {person.frame_count} frames")
                continue
                
            print(f"[INFO] Salvando dados de {pid} - detectado por {person.frame_count} frames")
            
            # Salvar eventos
            for event in person.events:
                log_event(event['ts'], event['person_id'], event['camera_id'], 
                         event['event_type'], event['roi_id'], event['conf'], event['extra'])
                total_events += 1
            
            # Salvar paths (amostragem para não sobrecarregar)
            for i, path in enumerate(person.paths):
                if i % 10 == 0:  # Salvar 1 a cada 10 posições
                    log_path(path['ts'], path['person_id'], path['x'], path['y'], 
                            path['roi_id'], path['camera_id'])
                    total_paths += 1
            
            # Salvar sessões (apenas a última de cada pessoa)
            if person.sessions:
                last_session = person.sessions[-1]
                upsert_session(last_session['ts'], last_session['person_id'], last_session['camera_id'])
                total_sessions += 1
        
        print(f"[OK] Dados salvos com sucesso!")
        print(f"[INFO] Total: {total_events} eventos, {total_paths} posições, {total_sessions} sessões")
        
    except Exception as e:
        print(f"[ERRO] Falha ao salvar no banco: {e}")
        print("[INFO] Dados processados mas não salvos no banco.")

if __name__ == "__main__":
    main()
