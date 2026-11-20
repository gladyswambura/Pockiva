data = open('apps/web/src/index.css', 'rb').read()
start = 0
positions = []
while True:
    idx = data.find(b'mob-attention', start)
    if idx < 0:
        break
    positions.append(idx)
    start = idx + 1

open('tmp_positions.txt', 'w').write(f'count: {len(positions)}\npositions: {positions[:10]}')

# Dump around each unique block start (where a . precedes it)
blocks = [p for p in positions if data[p-1:p] == b'.']
open('tmp_blocks.txt', 'w').write(f'block starts: {blocks[:10]}')
if len(blocks) >= 2:
    open('tmp_second_block.txt', 'wb').write(data[blocks[1]-2:blocks[1]+800])
