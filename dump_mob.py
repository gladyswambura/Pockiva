data = open('apps/web/src/index.css', 'rb').read()

start = data.find(b'.mob-layout {')
end = data.find(b'.home-root', start)

open('tmp_mob_section.txt', 'wb').write(data[start:end])
open('tmp_bounds.txt', 'w').write(f'start={start} end={end} length={end-start}')
