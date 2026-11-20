data = open('apps/web/src/index.css', 'rb').read()

# Show context around mob-guide-card__btn
idx = data.find(b'mob-guide-card__btn')
open('tmp_btn_ctx.txt', 'wb').write(data[idx:idx+400])

# Show context around mob-guide-card__link if it exists
idx2 = data.find(b'mob-guide-card__link')
if idx2 >= 0:
    open('tmp_link_ctx.txt', 'wb').write(data[idx2-10:idx2+300])
else:
    open('tmp_link_ctx.txt', 'w').write('NOT FOUND')
