"""Creates the image test files used by media.cjs (valid + hostile). Usage: python3 make-media-fixtures.py OUTDIR"""
import os, sys
from PIL import Image
d = (sys.argv[1] if len(sys.argv) > 1 else "media-fixtures") + "/"
os.makedirs(d, exist_ok=True)
im = Image.new("RGB", (600, 400), (200, 30, 30))
im.save(d + "ok.jpg", "JPEG"); im.save(d + "ok.png", "PNG"); im.save(d + "ok.webp", "WEBP"); im.save(d + "ok.gif", "GIF")
open(d + "script.svg", "w").write('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>')
open(d + "shell.php", "w").write('<?php system($_GET["c"]); ?>')
b = open(d + "ok.jpg", "rb").read()
open(d + "polyglot.jpg", "wb").write(b + b'\n<?php system($_GET["c"]); ?>')
open(d + "empty.jpg", "wb").write(b"")
open(d + "corrupt.jpg", "wb").write(b"\xff\xd8\xff\xe0" + os.urandom(3000))
open(d + "fake.jpg", "wb").write(b"MZ" + os.urandom(2000))
open(d + "huge.jpg", "wb").write(b[:2000] + b"\0" * (11 * 1024 * 1024))
Image.new("L", (12000, 12000), 0).save(d + "bomb.png", "PNG", optimize=True)
print("fixtures in", d)
