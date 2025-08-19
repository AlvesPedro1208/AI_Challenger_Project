import argparse, json, os, sys
import cv2
import numpy as np

HELP_TEXT = [
    "Controles:",
    "  ESQ clique: adiciona ponto",
    "  DIR clique: desfaz ponto",
    "  C: fechar poligono e nomear ROI",
    "  D: remover ultima ROI criada",
    "  S: salvar e sair",
    "  H: mostrar/ocultar ajuda",
    "  ESC/Q: sair sem salvar",
]

def draw_help(frame, show=True):
    if not show: return frame
    y = 20
    for line in HELP_TEXT:
        cv2.putText(frame, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(frame, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        y += 22
    return frame

def mouse_cb(event, x, y, flags, state):
    if event == cv2.EVENT_LBUTTONDOWN:
        state["current_pts"].append((x, y))
    elif event == cv2.EVENT_RBUTTONDOWN:
        if state["current_pts"]:
            state["current_pts"].pop()

def polygon_area(pts):
    return cv2.contourArea(np.array(pts, dtype=np.float32))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, help="Caminho do video")
    ap.add_argument("--json", default="rois.json", help="Arquivo JSON (merge por video)")
    ap.add_argument("--seek", type=float, default=0.0, help="Segundos para posicionar no frame")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        print(f"Video nao encontrado: {args.video}"); sys.exit(1)

    cap = cv2.VideoCapture(args.video)
    if args.seek > 0:
        cap.set(cv2.CAP_PROP_POS_MSEC, args.seek * 1000.0)
    ok, frame = cap.read(); cap.release()
    if not ok:
        print("Falha ao ler frame."); sys.exit(1)

    state = {"base": frame.copy(), "current_pts": [], "rois": [], "show_help": True}
    win = "ROI Picker"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(win, mouse_cb, state)
    cv2.resizeWindow(win, int(frame.shape[1]*0.8), int(frame.shape[0]*0.8))

    def redraw():
        img = state["base"].copy()
        # ROIs existentes
        for i, roi in enumerate(state["rois"]):
            pts = np.array(roi["points"], dtype=np.int32)
            cv2.polylines(img, [pts], True, (0,255,255), 2)
            cx, cy = int(np.mean(pts[:,0])), int(np.mean(pts[:,1]))
            label = f"{i+1}:{roi['name']}"
            cv2.putText(img, label, (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 3, cv2.LINE_AA)
            cv2.putText(img, label, (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,255), 2, cv2.LINE_AA)
        # polígono em edição
        if state["current_pts"]:
            for p in state["current_pts"]:
                cv2.circle(img, p, 4, (0,200,255), -1)
            pts = np.array(state["current_pts"], dtype=np.int32)
            if len(pts) >= 2:
                cv2.polylines(img, [pts], False, (0,200,255), 2)
        draw_help(img, state["show_help"])
        cv2.imshow(win, img)

    while True:
        redraw()
        k = cv2.waitKey(10) & 0xFF
        if k in (27, ord('q')):  # ESC/q
            print("Saindo sem salvar."); cv2.destroyAllWindows(); sys.exit(0)
        elif k == ord('h'):
            state["show_help"] = not state["show_help"]
        elif k == ord('c'):
            if len(state["current_pts"]) < 3:
                print("Min 3 pontos."); continue
            if polygon_area(state["current_pts"]) < 50:
                print("Poligono muito pequeno."); state["current_pts"].clear(); continue
            try:
                name = input("Nome da ROI (ex: shelf_A): ").strip()
            except EOFError:
                name = ""
            if not name: name = f"roi_{len(state['rois'])+1}"
            roi = {"name": name, "points": [(int(x), int(y)) for (x,y) in state["current_pts"]]}
            state["rois"].append(roi); state["current_pts"].clear()
            print(f"ROI adicionada: {roi['name']}")
        elif k == ord('d'):
            if state["rois"]:
                removed = state["rois"].pop(); print(f"Removida ROI: {removed['name']}")
        elif k == ord('s'):
            data = {}
            if os.path.exists(args.json):
                try:
                    with open(args.json, "r", encoding="utf-8") as f: data = json.load(f)
                except Exception: data = {}
            key = os.path.basename(args.video)
            data[key] = state["rois"]
            with open(args.json, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Salvo em {args.json} (chave: {key})")
            break
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
