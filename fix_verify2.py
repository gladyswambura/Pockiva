data = open('apps/web/src/index.css', 'rb').read()
start = 0
i = 0
while True:
    idx = data.find(b'mob-guide-card__link', start)
    if idx < 0: break
    i += 1
    open(f'tmp_link_{i}.txt', 'wb').write(data[idx-80:idx+220])
    start = idx + 1
open('tmp_link_count.txt', 'w').write(f'total: {i}')
