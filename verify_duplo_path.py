import json
import math

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

W = 400.0
D = 300.0
H = 400.0
R = 80.0
T = 18.0

num_arc = 28

# front_path
fp = [[W, 0.0], [R, 0.0]]
# Arc 1
for s in range(1, num_arc):
    ang = 1.5 * math.pi - (0.5 * math.pi) * (s / num_arc)
    px = R + R * math.cos(ang)
    py = R + R * math.sin(ang)
    fp.append([round(px, 4), round(py, 4)])
fp.append([0.0, R])
fp.append([0.0, D - R])
# Arc 2
for s in range(1, num_arc):
    ang = math.pi - (0.5 * math.pi) * (s / num_arc)
    px = R + R * math.cos(ang)
    py = (D - R) + R * math.sin(ang)
    fp.append([round(px, 4), round(py, 4)])
fp.append([R, D])
fp.append([W, D])

print('Calculated duplo front_path len:', len(fp), 'Official len:', len(official['front_path']))
print('fp[0]:', fp[0], 'fp[1]:', fp[1])
print('fp[29]:', fp[29], 'fp[30]:', fp[30])
print('fp[-2]:', fp[-2], 'fp[-1]:', fp[-1])
