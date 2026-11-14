import json
import math

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

W = 280.0
D = 350.0
H = 400.0
R = 80.0
T = 18.0

num_arc = 28

# front_path
fp = [[W, 0.0], [R, 0.0]]
for s in range(1, num_arc):
    ang = 1.5 * math.pi - (0.5 * math.pi) * (s / num_arc)
    px = R + R * math.cos(ang)
    py = R + R * math.sin(ang)
    fp.append([round(px, 4), round(py, 4)])
fp.append([0.0, R])
fp.append([0.0, D])

print('Calculated front_path len:', len(fp), 'Official len:', len(official['front_path']))
diff = max(abs(fp[i][0] - official['front_path'][i][0]) + abs(fp[i][1] - official['front_path'][i][1]) for i in range(len(fp)))
print('Max difference in front_path:', diff)

# top_outline
top = []
# Arc points 0 to 28
for s in range(num_arc + 1):
    ang = 1.5 * math.pi - (0.5 * math.pi) * (s / num_arc)
    px = R + R * math.cos(ang)
    py = R + R * math.sin(ang)
    top.append([round(px, 4), round(py, 4)])

# left side offset by T - 1
top.append([17.0, R])
top.append([17.0, D])
top.append([0.0, D])
top.append([0.0, D - T])
top.append([70.0, D - T])
top.append([70.0, D])
top.append([W, D])
# 2 ripa slots along right side
y_ripa1_top = 280.0
y_ripa1_bot = 210.0
y_ripa2_top = 140.0
y_ripa2_bot = 70.0

top.append([W, y_ripa1_top])
top.append([W - T, y_ripa1_top])
top.append([W - T, y_ripa1_bot])
top.append([W, y_ripa1_bot])
top.append([W, y_ripa2_top])
top.append([W - T, y_ripa2_top])
top.append([W - T, y_ripa2_bot])
top.append([W, y_ripa2_bot])

top.append([W, 17.0])
top.append([R, 17.0])
top.append([R, 0.0])

print('Calculated top_outline len:', len(top), 'Official len:', len(official['top_outline']))
diff_top = max(abs(top[i][0] - official['top_outline'][i][0]) + abs(top[i][1] - official['top_outline'][i][1]) for i in range(len(top)))
print('Max difference in top_outline:', diff_top)
