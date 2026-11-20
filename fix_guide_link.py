data = open('apps/web/src/index.css', 'rb').read()
idx = data.find(b'mob-guide-card__btn')
chunk = data[idx:idx+300]

# Write hex to inspect
with open('tmp_hex.txt', 'w') as f:
    f.write(' '.join(hex(b) for b in chunk))

# Find the closing brace after mob-guide-card__btn block
# Insert link style right after it
marker = b'mob-guide-card__btn'
start = data.find(marker)
# find the closing } of this block
close = data.find(b'}', start)
insert_at = close + 1

link_style = b'\n.mob-guide-card__link {\n  display: block;\n  width: 100%;\n  margin-top: 8px;\n  background: none;\n  border: 0;\n  font-size: 13px;\n  color: var(--color-text-muted);\n  text-align: center;\n  cursor: pointer;\n  text-decoration: underline;\n}\n'

new_data = data[:insert_at] + link_style + data[insert_at:]
open('apps/web/src/index.css', 'wb').write(new_data)

verify = open('apps/web/src/index.css', 'rb').read()
result = open('tmp_result.txt', 'w')
result.write('found' if b'mob-guide-card__link' in verify else 'MISSING')
result.close()
