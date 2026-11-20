data = open('apps/web/src/index.css', 'rb').read()
idx = data.find(b'mob-attention')
open('tmp_attention.txt', 'wb').write(data[idx:idx+1500])
