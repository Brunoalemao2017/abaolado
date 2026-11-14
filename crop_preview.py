from PIL import Image

for name in ['step_803_shot_1_step_802_curvo_simples_official.png', 'step_803_shot_2_step_802_curvo_duplo_official.png']:
    im = Image.open(rf'C:\Users\bruno\.gemini\antigravity\brain\72f4ef3d-599d-43cb-b3b2-c311ae600631\{name}')
    print(f"{name} size: {im.size}")
