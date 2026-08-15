from pathlib import Path
p = Path('/home/ubuntu/package-earn-pro/client/src/pages/Home.tsx')
s = p.read_text()
needle = 'function WhatsAppBanner('
starts = []
pos = 0
while True:
    i = s.find(needle, pos)
    if i < 0:
        break
    starts.append(i)
    pos = i + len(needle)
if len(starts) > 1:
    second = starts[1]
    end = s.find('function ProfileSetup', second)
    if end >= 0:
        s = s[:second] + s[end:]
p.write_text(s)
