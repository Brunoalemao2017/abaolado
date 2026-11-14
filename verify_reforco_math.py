import json
import math

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

ro = official['reforco_outline']
print('reforco_outline points count:', len(ro))
print('ro[0]:', ro[0], 'ro[1]:', ro[1], 'ro[2]:', ro[2])
print('ro[30]:', ro[30], 'ro[31]:', ro[31], 'ro[32]:', ro[32])
print('ro[60]:', ro[60], 'ro[61]:', ro[61], 'ro[62]:', ro[62])

# Notice ro[30] = [80.0, 0.0], ro[31] = [80.0, 39.5]
# Radius of outer arc = 80.0
# Radius of inner arc = 80.0 - 40.5 = 39.5!
# And points 2 to 30: outer arc
# Points 32 to 60: inner arc
# Points 61, 62, 0, 1: tab extending to y = 122!
