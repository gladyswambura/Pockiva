data = open('apps/web/src/index.css', 'rb').read()
start = 0
count = 0
while True:
    idx = data.find(b'mob-guide-card__link', start)
    if idx < 0:
        break
    count += 1
    open(f'tmp_occ_{count}.txt', 'wb').write(data[idx-50:idx+200])
    start = idx + 1
open('tmp_count.txt', 'w').write(f'occurrences: {count}')
