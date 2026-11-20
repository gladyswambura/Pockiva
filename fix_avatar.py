data = open('apps/web/src/index.css', 'rb').read()

# Fix broken mob-avatar: "background: #102D56; color: #fff;\n  font-size" has a stray \n after border: 0;
# The broken part is: "border: 0;\n  background" should be "border: 0;\n  background" - actually let's see exact bytes
idx = data.find(b'mob-avatar')
chunk = data[idx:idx+300]
with open('tmp_avatar_raw.txt', 'wb') as f:
    f.write(chunk)
