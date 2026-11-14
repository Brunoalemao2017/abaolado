with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("""      }
    };
  }
  calcularRipado(params) {""", """      }
    };
  },
  calcularRipado(params) {""")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed comma in algorithms.js')
