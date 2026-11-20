data = open('apps/web/src/index.css', 'rb').read()

# 1. Fix stray newline in mob-avatar (border: 0;\n  background -> border: 0;\n  background is fine,
#    but there was a \n before border: 0 in the earlier dump)
data = data.replace(
    b'  width: 40px; height: 40px; border-radius: 50%; \nborder: 0;\n',
    b'  width: 40px; height: 40px; border-radius: 50%; border: 0;\n'
)

# 2. Fix stray blank line inside mob-balance-card__label
data = data.replace(
    b'  opacity: .75; text-transform: uppercase;\n\n}\n',
    b'  opacity: .75; text-transform: uppercase;\n}\n'
)

# 3. Add mob-guide-card__skip style if missing (the skip button in guide header)
if b'mob-guide-card__skip' not in data:
    data = data.replace(
        b'.mob-guide-card__title { font-size: 16px; font-weight: 800; color: #182640; }\n',
        b'.mob-guide-card__title { font-size: 16px; font-weight: 800; color: #182640; }\n'
        b'.mob-guide-card__skip { background: none; border: none; font-size: 13px; color: #7C8AA6; cursor: pointer; padding: 4px; }\n'
    )

# 4. Add mob-guide-card__link after mob-guide-card__btn in the second (mob-layout) block
# The second block has: background: #D0A03F; color: #182640;\n  font-size: 15px; font-weight: 700; cursor: pointer;\n}\n\n/* Section header
old_btn_end = (
    b'.mob-guide-card__btn {\n'
    b'  width: 100%; height: 46px; margin-top: 14px;\n'
    b'  border: 0; border-radius: 12px;\n'
    b'  background: #D0A03F; color: #182640;\n'
    b'  font-size: 15px; font-weight: 700; cursor: pointer;\n'
    b'}\n'
)
link_style = (
    b'.mob-guide-card__link {\n'
    b'  display: block; width: 100%; margin-top: 8px;\n'
    b'  background: none; border: 0; font-size: 13px;\n'
    b'  color: #7C8AA6; text-align: center; cursor: pointer;\n'
    b'  text-decoration: underline;\n'
    b'}\n'
)
if old_btn_end in data and b'mob-guide-card__link' not in data[data.find(old_btn_end):data.find(old_btn_end)+300]:
    data = data.replace(old_btn_end, old_btn_end + link_style, 1)

open('apps/web/src/index.css', 'wb').write(data)

# Verify
result = open('apps/web/src/index.css', 'rb').read()
checks = {
    'avatar_fixed': b'border-radius: 50%; border: 0;\n  background: #102D56' in result,
    'label_fixed': b'text-transform: uppercase;\n}\n.mob-balance-card__value' in result,
    'skip_style': b'mob-guide-card__skip' in result,
    'link_style_count': result.count(b'mob-guide-card__link'),
}
open('tmp_fix_result.txt', 'w').write(str(checks))
