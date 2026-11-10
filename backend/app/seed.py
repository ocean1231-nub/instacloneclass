"""Populate an empty classroom database with deterministic example posts."""
from io import BytesIO
import secrets
from PIL import Image, ImageDraw
from argon2 import PasswordHasher
from sqlalchemy import func, select, text
from .models import Post, User


def sample_image(index):
    colors = [(181, 211, 188), (229, 199, 174), (193, 208, 229),
              (232, 195, 199), (222, 216, 170), (199, 193, 224)]
    image = Image.new("RGB", (720, 800), colors[index % len(colors)])
    draw = ImageDraw.Draw(image)
    draw.ellipse((440, 80, 610, 250), fill=(255, 244, 213))
    draw.polygon([(0, 650), (260, 310), (530, 650)], fill=(105, 151, 135))
    draw.polygon([(180, 700), (510, 360), (720, 650), (720, 800), (0, 800)], fill=(72, 116, 108))
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def seed_database(session_factory, storage):
    with session_factory.begin() as session:
        session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": 718035015})
        if session.scalar(select(func.count()).select_from(User)) or session.scalar(select(func.count()).select_from(Post)):
            return
        urls = [storage.upload_if_missing(f"examples/post-{i + 1}.png", sample_image(i)) for i in range(6)]
        password_hash = PasswordHasher().hash(secrets.token_urlsafe(32))
        users = [User(username="minji.daily", display_name="김민지", bio="일상을 기록해요", avatar_url=urls[0], password_hash=password_hash),
                 User(username="coffee.zip", display_name="커피집", bio="작은 여유를 나눠요", avatar_url=urls[1], password_hash=password_hash)]
        session.add_all(users)
        session.flush()
        captions = ["초록빛 하루", "오늘의 작은 여유", "산책하고 싶은 날", "따뜻한 오후", "기분 좋은 풍경", "하루를 기록해요"]
        session.add_all([Post(author_id=users[i % 2].id, image_url=urls[i], caption=captions[i]) for i in range(6)])
