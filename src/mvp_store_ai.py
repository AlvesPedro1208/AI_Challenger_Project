# src/mvp_store_ai.py
import argparse, json, os, time, math
import cv2
import numpy as np
from ultralytics import YOLO
from dotenv import load_dotenv; load_dotenv()

from db_oracle import init_db, log_event, log_path, upsert_session, log_customer_object, log_purchase_validation, save_analysis_data_batch, _ts

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

def assign_customer_tag(person_state):
    """Atribui uma cor única para TAG do cliente"""
    if not person_state.tag_assigned:
        # Cores distintas para diferentes clientes
        colors = [(255,0,0), (0,255,0), (0,0,255), (255,255,0), (255,0,255), (0,255,255), (128,0,128), (255,165,0)]
        person_state.tag_color = colors[hash(person_state.pid) % len(colors)]
        person_state.tag_assigned = True

def detect_gaze_direction(keypoints, roi_center):
    """Detecta se a pessoa está olhando para uma ROI baseado na pose da cabeça"""
    if keypoints is None or len(keypoints) < 5:
        return False
    
    # Pontos da cabeça: nose(0), left_eye(1), right_eye(2), left_ear(3), right_ear(4)
    nose = keypoints[0]
    left_eye = keypoints[1]
    right_eye = keypoints[2]
    
    if nose[0] <= 0 or nose[1] <= 0 or left_eye[0] <= 0 or right_eye[0] <= 0:
        return False
    
    # Calcular direção do olhar baseado na orientação da cabeça
    eye_center = ((left_eye[0] + right_eye[0]) / 2, (left_eye[1] + right_eye[1]) / 2)
    head_direction = (nose[0] - eye_center[0], nose[1] - eye_center[1])
    
    # Vetor da cabeça para a ROI
    to_roi = (roi_center[0] - nose[0], roi_center[1] - nose[1])
    
    # Calcular ângulo (simplificado)
    dot_product = head_direction[0] * to_roi[0] + head_direction[1] * to_roi[1]
    head_mag = math.hypot(head_direction[0], head_direction[1])
    roi_mag = math.hypot(to_roi[0], to_roi[1])
    
    if head_mag == 0 or roi_mag == 0:
        return False
    
    cos_angle = dot_product / (head_mag * roi_mag)
    # Se o ângulo for menor que 45 graus, considera que está olhando
    return cos_angle > 0.7  # cos(45°) ≈ 0.707

def detect_object_in_hands(keypoints, roi_polygons):
    """Detecta se há objeto nas mãos baseado na posição dos punhos"""
    if keypoints is None or len(keypoints) < 11:
        return False, None
    
    # Punhos: left_wrist(9), right_wrist(10)
    left_wrist = keypoints[9]
    right_wrist = keypoints[10]
    
    # Verificar se os punhos estão em posição de segurar objeto
    for roi_name, roi_poly in roi_polygons.items():
        # Se os punhos estão próximos e em posição elevada (segurando algo)
        if (left_wrist[0] > 0 and left_wrist[1] > 0 and 
            right_wrist[0] > 0 and right_wrist[1] > 0):
            
            wrist_distance = euclid(left_wrist, right_wrist)
            # Se os punhos estão próximos (segurando algo)
            if 20 < wrist_distance < 100:
                return True, roi_name
    
    return False, None

def detect_cart_interaction(keypoints, person_center, cart_areas):
    """Detecta interação com carrinho de compras"""
    if keypoints is None or not cart_areas:
        return False
    
    # Verificar se a pessoa está próxima de uma área de carrinho
    for cart_area in cart_areas:
        if point_in_poly(person_center, cart_area):
            # Verificar movimento das mãos indicando colocação de item
            left_wrist = keypoints[9] if len(keypoints) > 9 else None
            right_wrist = keypoints[10] if len(keypoints) > 10 else None
            
            if (left_wrist and left_wrist[0] > 0 and left_wrist[1] > 0 and
                right_wrist and right_wrist[0] > 0 and right_wrist[1] > 0):
                # Verificar se as mãos estão em movimento descendente (colocando algo)
                wrist_distance = euclid(left_wrist, right_wrist)
                # Movimento típico de colocação no carrinho
                if wrist_distance > 30:  # Mãos separadas indicando colocação
                    return True
    
    return False

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
        self.customer_objects = []
        self.purchase_validations = []
        # Contador de frames para filtrar detecções falsas
        self.frame_count = 0
        
        # Novos estados para comportamentos avançados
        self.gaze_start_ts = {}  # Quando começou a olhar para cada ROI
        self.gaze_duration = {}  # Duração do olhar em cada ROI
        self.holding_object = False
        self.object_picked_from = None
        self.object_pick_ts = None
        self.cart_interactions = []
        self.propensity_level = None  # 'low', 'medium', 'high'
        self.predicted_items = []  # Items que a IA prevê que o cliente vai comprar
        self.is_at_checkout = False
        self.checkout_start_ts = None
        
        # Tracking de pose para detecção de olhar
        self.head_direction_hist = []
        self.hand_positions_hist = []
        
        # TAG visual persistente
        self.tag_color = None
        self.tag_assigned = False
        
        # Controles de debounce para logs
        self.last_gaze_log = {}
        self.last_object_log = {}
        self.log_cooldown = 2.0  # 2 segundos entre logs similares
        
        # Controle de tempo mínimo para GAZE (4 segundos)
        self.gaze_start_time = {}  # ROI -> timestamp quando começou a olhar
        self.gaze_confirmed = {}   # ROI -> se já foi confirmado o olhar
        self.min_gaze_time = 4.0   # 4 segundos mínimos para confirmar olhar
        
        # Buffer para estabilizar detecção de objetos
        self.object_detection_buffer = []
        self.buffer_size = 10  # Número de frames para confirmar mudança de estado
        self.stable_object_state = False
        self.stable_object_roi = None
        self.fired_hold = {}  # Controle para evitar múltiplos eventos de segurar
        self.fired_pick = {}  # Controle para evitar múltiplos eventos de pegar
        self.fired_drop = {}  # Controle para evitar múltiplos eventos de soltar
        self.state_change_cooldown = 2.0  # Cooldown de 2 segundos entre mudanças de estado
        self.last_state_change = 0
        self.current_interaction_id = None  # ID único para cada interação com objeto

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--rois", default="rois.json")
    ap.add_argument("--camera-id", default="cam01")
    ap.add_argument("--dwell-sec", type=float, default=3.0)
    ap.add_argument("--reach-frames", type=int, default=6)
    ap.add_argument("--depart-px", type=float, default=250.0)
    ap.add_argument("--depart-window", type=float, default=3.0)
    # Novos parâmetros para comportamentos avançados
    ap.add_argument("--gaze-sec", type=float, default=4.0, help="Segundos olhando para ROI (baixa propensão)")
    ap.add_argument("--hold-frames", type=int, default=15, help="Frames segurando objeto (média propensão)")
    ap.add_argument("--cart-area", default="cart", help="Nome da ROI do carrinho")
    ap.add_argument("--checkout-area", default="checkout", help="Nome da ROI do caixa")
    args = ap.parse_args()

    # Carregar ROIs
    with open(args.rois, "r", encoding="utf-8") as f:
        all_rois = json.load(f)
    video_key = os.path.basename(args.video)
    if video_key not in all_rois or not all_rois[video_key]:
        raise ValueError(f"Sem ROIs para {video_key} em {args.rois}")

    rois = []
    cart_areas = []
    checkout_areas = []
    
    # Definir áreas do carrinho (podem ser configuradas por vídeo)
    default_cart_areas = [
        {'center': (100, 400), 'radius': 80},  # Área do carrinho 1
        {'center': (200, 450), 'radius': 80},  # Área do carrinho 2
    ]
    
    for roi in all_rois[video_key]:
        pts = clean_poly(roi["points"])
        if len(pts) >= 3:
            roi_data = {"name": roi["name"], "poly": pts}
            rois.append(roi_data)
            
            # Separar áreas especiais
            if args.cart_area.lower() in roi["name"].lower():
                cart_areas.append(pts)
            elif args.checkout_area.lower() in roi["name"].lower():
                checkout_areas.append(pts)

    print(f"[INFO] {video_key} -> ROIs: {[r['name'] for r in rois]}")
    print(f"[INFO] Áreas de carrinho: {len(cart_areas)}, Áreas de caixa: {len(checkout_areas)}")

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
                             tracker="bytetrack.yaml", conf=0.3, iou=0.5)
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
                    assign_customer_tag(st)  # Atribuir TAG colorida
                    print(f"[INFO] Nova pessoa detectada: {pid} - TAG atribuída")
                
                st.frame_count += 1
                st.last_ts = ts
                if st.first_ts is None: st.first_ts = ts
                
                # Só registrar eventos após a pessoa ser detectada por pelo menos 10 frames
                if st.frame_count == 10:
                    st.events.append({
                        'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                        'event_type': 'entrar_loja', 'roi_id': None, 'conf': None, 'extra': None
                    })
                    print(f"[EVENT] {pid} entrou na loja (confirmado após {st.frame_count} frames)")
                
                # Coletar sessão para salvar depois
                st.sessions.append({
                    'ts': ts, 'person_id': pid, 'camera_id': args.camera_id
                })

                c = box_center(xyxys[i])
                st.center_hist.append(c)  # Atualizar histórico de centro para estatísticas
                in_roi = None
                for rr in rois:
                    if point_in_poly(c, rr["poly"]):
                        in_roi = rr["name"]; break
                
                # Coletar posição para salvar depois
                st.paths.append({
                    'ts': ts, 'person_id': pid, 'x': c[0], 'y': c[1], 
                    'roi_id': in_roi, 'camera_id': args.camera_id
                })

                # Detecção de olhar melhorada para prateleiras com tempo mínimo de 4 segundos
                keypoints = kp_xy[i] if kp_xy is not None else None
                currently_gazing_rois = []
                
                for rr in rois:
                    roi_center = (int(np.mean(rr["poly"][:,0])), int(np.mean(rr["poly"][:,1])))
                    is_gazing = detect_gaze_direction(keypoints, roi_center)
                    
                    if is_gazing:
                        currently_gazing_rois.append(rr["name"])
                        roi_name = rr["name"]
                        
                        # Iniciar contagem de tempo se ainda não começou
                        if roi_name not in st.gaze_start_time:
                            st.gaze_start_time[roi_name] = ts
                            st.gaze_confirmed[roi_name] = False
                        
                        # Verificar se já passou o tempo mínimo (4 segundos)
                        gaze_duration = ts - st.gaze_start_time[roi_name]
                        if gaze_duration >= st.min_gaze_time and not st.gaze_confirmed[roi_name]:
                            # Confirmar o olhar após 4 segundos
                            st.gaze_confirmed[roi_name] = True
                            gaze_key = f"olhar_prateleira_{roi_name}"
                            if gaze_key not in st.fired:
                                st.fired.add(gaze_key)
                                # Debounce para logs de GAZE
                                gaze_log_key = f"gaze_{roi_name}"
                                if gaze_log_key not in st.last_gaze_log or (ts - st.last_gaze_log[gaze_log_key]) > st.log_cooldown:
                                    print(f"[GAZE] {pid} está olhando para {roi_name} (4+ segundos)")
                                    st.last_gaze_log[gaze_log_key] = ts
                                # Evento de baixa propensão por olhar prolongado
                                st.events.append({
                                    'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                    'event_type': 'permanencia_baixa', 'roi_id': roi_name, 'conf': 0.7,
                                    'extra': {"gaze_s": round(gaze_duration,2), "method": "gaze_detection"}
                                })
                                print(f"[EVENT] {pid} olhou {gaze_duration:.1f}s para {roi_name} (LOW - GAZE)")
                                cv2.putText(frame, f"GAZE LOW {pid}@{roi_name}", (int(c[0]), int(c[1]-40)),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,200,0), 2)
                
                # Reset gaze para ROIs que não estão sendo olhadas
                for roi_name in list(st.gaze_start_time.keys()):
                    if roi_name not in currently_gazing_rois:
                        del st.gaze_start_time[roi_name]
                        if roi_name in st.gaze_confirmed:
                            del st.gaze_confirmed[roi_name]

                # Regra 1 - Dwell (permanência física na ROI)
                if in_roi:
                    if in_roi not in st.roi_enter_ts:
                        st.roi_enter_ts[in_roi] = ts
                    dwell = ts - st.roi_enter_ts[in_roi]
                    key = f"permanencia_baixa_{in_roi}"
                    if dwell >= args.dwell_sec and key not in st.fired:
                        st.fired.add(key)
                        # Coletar evento para salvar depois
                        st.events.append({
                            'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                            'event_type': 'permanencia_baixa', 'roi_id': in_roi, 'conf': 0.6,
                            'extra': {"dwell_s": round(dwell,2), "method": "physical_presence"}
                        })
                        print(f"[EVENT] {pid} ficou {dwell:.1f}s em {in_roi} (LOW - DWELL)")
                        cv2.putText(frame, f"DWELL LOW {pid}@{in_roi}", (int(c[0]), int(c[1]-20)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)
                else:
                    st.roi_enter_ts = {}

                # Detecção de objeto na mão para média propensão com buffer de estabilização
                roi_dict = {r["name"]: r["poly"] for r in rois}
                has_object, object_roi = detect_object_in_hands(keypoints, roi_dict)
                
                # Adicionar detecção atual ao buffer
                st.object_detection_buffer.append((has_object, object_roi))
                if len(st.object_detection_buffer) > st.buffer_size:
                    st.object_detection_buffer.pop(0)
                
                # Determinar estado estável baseado no buffer
                if len(st.object_detection_buffer) >= st.buffer_size:
                    # Contar detecções positivas no buffer
                    positive_detections = sum(1 for detection, _ in st.object_detection_buffer if detection)
                    threshold = st.buffer_size * 0.8  # 80% dos frames devem detectar objeto
                    
                    current_stable_state = positive_detections >= threshold
                    current_stable_roi = None
                    
                    if current_stable_state:
                        # Encontrar ROI mais comum no buffer
                        roi_counts = {}
                        for detection, roi in st.object_detection_buffer:
                            if detection and roi:
                                roi_counts[roi] = roi_counts.get(roi, 0) + 1
                        if roi_counts:
                            current_stable_roi = max(roi_counts, key=roi_counts.get)
                    
                    # Verificar mudança de estado estável (com cooldown)
                    if (current_stable_state != st.stable_object_state or current_stable_roi != st.stable_object_roi) and (ts - st.last_state_change) > st.state_change_cooldown:
                        if current_stable_state and current_stable_roi:
                            # Começou a segurar objeto (estado estável)
                            if not st.holding_object:
                                # Criar ID único para esta interação
                                interaction_id = f"{current_stable_roi}_{int(ts)}"
                                st.current_interaction_id = interaction_id
                                
                                st.holding_object = True
                                st.object_picked_from = current_stable_roi
                                st.object_pick_ts = ts
                                
                                # Verificar se já foi registrado evento de pegar para esta ROI
                                if current_stable_roi not in st.fired_pick:
                                    st.fired_pick[current_stable_roi] = True
                                    print(f"[OBJECT] {pid} pegou objeto de {current_stable_roi}")
                                    
                                    # Log do evento de pegar objeto
                                    st.customer_objects.append({
                                        'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                        'object_type': 'produto', 'roi_id': current_stable_roi, 'action': 'pegar', 'confidence': 0.8
                                    })
                    
                        elif not current_stable_state:
                            # Parou de segurar objeto (estado estável)
                            if st.holding_object and st.object_picked_from:
                                # Verificar se já foi registrado evento de soltar para esta ROI
                                if st.object_picked_from not in st.fired_drop:
                                    st.fired_drop[st.object_picked_from] = True
                                    print(f"[OBJECT] {pid} soltou objeto de {st.object_picked_from}")
                                    
                                    # Log do evento de colocar objeto
                                    st.customer_objects.append({
                                        'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                        'object_type': 'produto', 'roi_id': st.object_picked_from, 'action': 'colocar', 'confidence': 0.7
                                    })
                                
                                # Reset dos estados
                                st.holding_object = False
                                st.object_picked_from = None
                                st.object_pick_ts = None
                                st.current_interaction_id = None
                                
                                # Reset dos controles de fired para permitir nova interação
                                st.fired_pick = {}
                                st.fired_drop = {}
                                st.fired_hold = {}
                        
                        # Atualizar estado estável
                        st.stable_object_state = current_stable_state
                        st.stable_object_roi = current_stable_roi
                        st.last_state_change = ts
                
                # Verificar se está segurando por tempo suficiente (usando estado estável)
                if st.holding_object and st.object_pick_ts and (ts - st.object_pick_ts) >= (args.hold_frames / 30.0):
                    if st.object_picked_from and not st.fired_hold.get(st.object_picked_from, False):
                        print(f"[EVENT] {pid} segurando objeto de {st.object_picked_from} (MED - HOLD)")
                        st.fired_hold[st.object_picked_from] = True
                        # Log do evento de segurar objeto
                        st.customer_objects.append({
                            'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                            'object_type': 'produto', 'roi_id': st.object_picked_from, 'action': 'segurar', 'confidence': 0.8
                        })

                # Regra 2 - Reach (alcance físico da ROI)
                for rr in rois:
                    if point_in_poly(c, rr["poly"]):
                        st.reach_frames[rr["name"]] = st.reach_frames.get(rr["name"], 0) + 1
                        if st.reach_frames[rr["name"]] >= args.reach_frames:
                            key = f"reach_{rr['name']}"
                            if key not in st.fired:
                                st.fired.add(key)
                                st.post_reach_ref[rr["name"]] = {"ts": ts, "center": c}
                                # Coletar evento para salvar depois
                                st.events.append({
                                    'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                    'event_type': 'alcance_medio', 'roi_id': rr["name"], 'conf': 0.75,
                                    'extra': {"method": "physical_reach"}
                                })
                                print(f"[EVENT] {pid} alcançou {rr['name']} (MED - REACH)")
                                cv2.putText(frame, f"REACH MED {pid}@{rr['name']}", (int(c[0]), int(c[1]-40)),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,165,255), 2)
                    else:
                        st.reach_frames[rr["name"]] = max(0, st.reach_frames.get(rr["name"], 0) - 1)

                # Detecção de colocação no carrinho para alta propensão
                if st.holding_object and cart_areas:
                    cart_interaction = detect_cart_interaction(keypoints, c, cart_areas)
                    if cart_interaction:
                        cart_key = f"colocar_carrinho_{st.object_picked_from}"
                        if cart_key not in st.fired:
                            st.fired.add(cart_key)
                            # Evento de alta propensão por colocar no carrinho
                            st.events.append({
                                'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                'event_type': 'colocar_carrinho_alta', 'roi_id': st.object_picked_from, 'conf': 0.9,
                                'extra': {"method": "cart_placement"}
                            })
                            print(f"[EVENT] {pid} colocou item de {st.object_picked_from} no carrinho (HIGH)")
                            cv2.putText(frame, f"CART HIGH {pid}", (int(c[0]), int(c[1]-80)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
                            
                            # Log do evento de colocar no carrinho
                            st.customer_objects.append({
                                'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                'object_type': 'produto', 'roi_id': st.object_picked_from, 'action': 'colocar_carrinho', 'confidence': 0.9
                            })
                            
                            # Resetar estado do objeto
                            st.holding_object = False
                            st.object_picked_from = None
                            st.object_pick_ts = None

                # Sistema de validação no checkout
                if checkout_areas:
                    for checkout in checkout_areas:
                        if point_in_poly(c, checkout["poly"]):
                            checkout_key = f"checkout_{checkout['name']}"
                            if checkout_key not in st.fired:
                                st.fired.add(checkout_key)
                                
                                # Calcular propensão total do cliente
                                propensao_score = 0
                                propensao_eventos = []
                                
                                # Verificar eventos de baixa propensão (olhar para prateleira)
                                baixa_eventos = [e for e in st.events if e['event_type'] == 'permanencia_baixa' and e.get('extra', {}).get('method') == 'gaze_detection']
                                if baixa_eventos:
                                    propensao_score += 1
                                    propensao_eventos.append('olhar_prateleira')
                                
                                # Verificar eventos de média propensão (segurar objeto)
                                media_eventos = [e for e in st.events if e['event_type'] == 'alcance_medio' and e.get('extra', {}).get('method') == 'object_holding']
                                if media_eventos:
                                    propensao_score += 2
                                    propensao_eventos.append('segurar_objeto')
                                
                                # Verificar eventos de alta propensão (colocar no carrinho)
                                alta_eventos = [e for e in st.events if e['event_type'] == 'colocar_carrinho_alta']
                                if alta_eventos:
                                    propensao_score += 3
                                    propensao_eventos.append('colocar_carrinho')
                                
                                # Classificar propensão final
                                if propensao_score >= 5:
                                    propensao_final = 'ALTA'
                                elif propensao_score >= 3:
                                    propensao_final = 'MEDIA'
                                elif propensao_score >= 1:
                                    propensao_final = 'BAIXA'
                                else:
                                    propensao_final = 'NENHUMA'
                                
                                # Log da validação no checkout
                                st.purchase_validations.append({
                                    'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                    'checkout_id': checkout['name'], 'predicted_propensity': propensao_final,
                                    'propensity_score': propensao_score, 'events_detected': ','.join(propensao_eventos),
                                    'actual_purchase': None  # Será preenchido posteriormente
                                })
                                
                                print(f"[CHECKOUT] {pid} no checkout {checkout['name']} - Propensão: {propensao_final} (Score: {propensao_score})")
                                cv2.putText(frame, f"CHECKOUT {propensao_final} {pid}", (int(c[0]), int(c[1]-100)),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,0), 2)

                # Regra 3 - Depart
                for name, ref in list(st.post_reach_ref.items()):
                    if ts - ref["ts"] <= args.depart_window:
                        if euclid(c, ref["center"]) >= args.depart_px and f"sair_alta_{name}" not in st.fired:
                            st.fired.add(f"sair_alta_{name}")
                            # Coletar evento para salvar depois
                            st.events.append({
                                'ts': ts, 'person_id': pid, 'camera_id': args.camera_id,
                                'event_type': 'sair_alta', 'roi_id': name, 'conf': 0.85,
                                'extra': {"method": "depart_after_reach"}
                            })
                            print(f"[EVENT] {pid} saiu após alcançar {name} (HIGH)")
                            cv2.putText(frame, f"DEPART HIGH {pid}", (int(c[0]), int(c[1]-60)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,255), 2)
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
    
    # Filter out false detections (less than 10 frames)
    valid_people = {pid: person for pid, person in persons.items() if len(person.center_hist) >= 10}
    total_customers = len(valid_people)
    total_events = sum(len(person.events) for person in valid_people.values())
    
    print(f"[STATS] TOTAL_CUSTOMERS: {total_customers}")
    print(f"[STATS] TOTAL_INTERACTIONS: {total_events}")
    print(f"[STATS] VALID_DETECTIONS: {list(valid_people.keys())}")
    
    # Salvar todos os dados no banco de uma vez usando lote
    print("[INFO] Salvando dados no Oracle Database...")
    try:
        init_db()  # garante schema/tabelas
        
        # Preparar dados em lote
        events_data = []
        objects_data = []
        paths_data = []
        sessions_data = []
        
        for pid, person in persons.items():
            # Filtrar pessoas que foram detectadas por muito pouco tempo
            if person.frame_count < 30:  # Menos de 30 frames = detecção falsa
                print(f"[INFO] Ignorando {pid} - detectado por apenas {person.frame_count} frames")
                continue
                
            print(f"[INFO] Preparando dados de {pid} - detectado por {person.frame_count} frames")
            
            # Preparar eventos
            for event in person.events:
                events_data.append({
                    'ts': _ts(event['ts']),
                    'pid': event['person_id'],
                    'cam': event['camera_id'],
                    'evt': event['event_type'],
                    'roi': event['roi_id'],
                    'conf': event['conf'],
                    'extra': event['extra']
                })
            
            # Preparar objetos do cliente
            for obj in person.customer_objects:
                objects_data.append({
                    'ts': _ts(obj['ts']),
                    'pid': obj['person_id'],
                    'cam': obj['camera_id'],
                    'obj_type': obj['object_type'],
                    'roi': obj['roi_id'],
                    'action': obj['action'],
                    'conf': obj['confidence']
                })
            
            # Preparar paths (amostragem para não sobrecarregar)
            for i, path in enumerate(person.paths):
                if i % 20 == 0:  # Reduzir ainda mais: 1 a cada 20 posições
                    paths_data.append({
                        'ts': _ts(path['ts']),
                        'pid': path['person_id'],
                        'cam': path['camera_id'],
                        'x': path['x'],
                        'y': path['y'],
                        'roi': path['roi_id']
                    })
            
            # Preparar sessões (apenas a última de cada pessoa)
            if person.sessions:
                last_session = person.sessions[-1]
                sessions_data.append({
                    'ts': _ts(last_session['ts']),
                    'pid': last_session['person_id'],
                    'cam': last_session['camera_id']
                })
        
        # Salvar tudo em lote
        save_analysis_data_batch(events_data, objects_data, paths_data, sessions_data)
        
        print(f"[OK] Dados salvos com sucesso!")
        print(f"[INFO] Total: {len(events_data)} eventos, {len(paths_data)} posições, {len(sessions_data)} sessões")
        
    except Exception as e:
        print(f"[ERRO] Falha ao salvar no banco: {e}")
        print("[INFO] Dados processados mas não salvos no banco.")

if __name__ == "__main__":
    main()
