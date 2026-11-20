data = open('apps/web/src/index.css', 'rb').read()

# Find all .mob-attention { (the section openers)
import re
matches = [(m.start(), m.group()) for m in re.finditer(rb'\.mob-attention\s*\{', data)]
open('tmp_section_starts.txt', 'w').write('\n'.join(f'{pos}: {txt}' for pos, txt in matches))

# Also find the mob-layout section marker to know where second block is
idx2 = data.find(b'mob-layout')
open('tmp_moblayout.txt', 'wb').write(data[idx2:idx2+100])
