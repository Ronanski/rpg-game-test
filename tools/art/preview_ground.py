import sys, numpy as np
from PIL import Image
import world, ground
w = world.build()
img, alpha, origin = ground.bake(w)
img = ground.shadows(img, w, origin)
out = np.dstack([img, alpha])
Image.fromarray(out, 'RGBA').save(sys.argv[1])
print(out.shape, origin)
