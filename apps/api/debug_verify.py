import asyncio, traceback
from app.core.db import engine, AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        result = await conn.execute(text('PRAGMA table_info(users)'))
        cols = [row[1] for row in result.fetchall()]
        print('COLS:', cols)

    from app.modules.auth.service import request_otp, verify_otp
    async with AsyncSessionLocal() as db:
        code = await request_otp(db, 'gladyswahito7@gmail.com')
        print('CODE:', code)
    async with AsyncSessionLocal() as db:
        try:
            tokens = await verify_otp(db, 'gladyswahito7@gmail.com', code)
            print('SUCCESS:', tokens[0][:20])
        except Exception:
            traceback.print_exc()

asyncio.run(main())
