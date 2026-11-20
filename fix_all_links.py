data = open('apps/web/src/index.css', 'rb').read()
start = 0
count = 0
results = []
while True:
    idx = data.find(b'mob-guide-card__link', start)
    if idx < 0:
        break
    count += 1
    results.append(idx)
    start = idx + 1

with open('tmp_all_links.txt', 'wb') as f:
    f.write(f'count: {count}\n'.encode())
    for i, pos in enumerate(results):
        f.write(f'\n=== occurrence {i+1} at byte {pos} ===\n'.encode())
        f.write(data[pos-60:pos+250])
        f.write(b'\n')
