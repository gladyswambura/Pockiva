data = open('apps/web/src/index.css', 'rb').read()

# Find mob-layout
idx = data.find(b'.mob-layout')
open('tmp_moblayout.txt', 'wb').write(data[idx:idx+3000])

# Also check total file size vs expected
open('tmp_size.txt', 'w').write(f'file size: {len(data)} bytes')
