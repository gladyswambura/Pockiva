data = open('apps/web/src/index.css', 'rb').read()
idx = data.find(b'mob-guide-card__link')
open('tmp_verify.txt', 'wb').write(data[idx-30:idx+250])
