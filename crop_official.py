from PIL import Image

im = Image.open(r'C:\Users\bruno\.gemini\antigravity\brain\72f4ef3d-599d-43cb-b3b2-c311ae600631\step_807_shot_2_step_806_full_view.png')
print("Full view size:", im.size)

# Crop header area
header = im.crop((0, 0, im.width, 180))
header.save(r'C:\Users\bruno\.gemini\antigravity\brain\72f4ef3d-599d-43cb-b3b2-c311ae600631\official_header.png')

# Crop categories area
cat = im.crop((0, 180, im.width, 320))
cat.save(r'C:\Users\bruno\.gemini\antigravity\brain\72f4ef3d-599d-43cb-b3b2-c311ae600631\official_categories.png')

# Crop form & preview area
main_area = im.crop((0, 320, im.width, im.height))
main_area.save(r'C:\Users\bruno\.gemini\antigravity\brain\72f4ef3d-599d-43cb-b3b2-c311ae600631\official_main_area.png')

print("Cropped successfully!")
