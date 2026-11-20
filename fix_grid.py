data = open('apps/web/src/index.css', 'rb').read()
idx = data.find(b'grid-template-columns: 27px')
if idx >= 0:
    open('tmp_grid.txt', 'wb').write(data[idx-200:idx+400])
else:
    open('tmp_grid.txt', 'w').write('NOT FOUND')

# Also check for min-height: 43px
idx2 = data.find(b'min-height: 43px')
if idx2 >= 0:
    open('tmp_43.txt', 'wb').write(data[idx2-200:idx2+200])
else:
    open('tmp_43.txt', 'w').write('NOT FOUND')
