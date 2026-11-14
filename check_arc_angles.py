import json
import math

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

# Official parameters: W = 280, D = 350, H = 400, R = 80, T = 18
W = 280.0
D = 350.0
H = 400.0
R = 80.0
T = 18.0

# 1. Front path
num_arc = 28
front_path = [[W, 0.0], [R, 0.0]]
# Arc from (R, 0) to (0, R) with center (R, R)
for s in range(1, num_arc):
    # angle goes from -PI/2 (or 3*PI/2) to PI
    # at s=0: (R, 0)
    # at s=num_arc: (0, R)
    ang = -math.pi / 2.0 - (math.pi / 2.0) * (s / num_arc)
    px = R + R * math.cos(ang)
    py = R - R * math.sin(ang)  # wait, let's check official coordinates!
    pass

print('Official front_path points 0 to 4:')
for p in official['front_path'][:5]:
    print(' ', p)
print('Official front_path point 29, 30:')
print(' 29:', official['front_path'][29])
print(' 30:', official['front_path'][30])
