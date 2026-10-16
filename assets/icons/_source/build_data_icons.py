# Crops the two icons out of the user's side-by-side (light | dark) reference sheets in
# assets/icons/settings/. Same crop rectangle for both halves so a theme swap never shifts
# the icon. LIGHT: feathered opaque crop (the light art is very pale — doc body sat≈0.11 —
# so any saturation/segmentation-based alpha fails; the page bg in light mode is pure #fff).
# DARK: real alpha from black (art is bright on black), incl. the soft glow.
import numpy as np, sys
from PIL import Image
SRC='/Volumes/PBE Main HD/VSC/ChatPracticeWeb/assets/icons/settings/'
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/zelo_pw_test/dataicons/'
S=600; OUTW=300; SEAM=887
JOBS={'settings2-data-request':'First data.png','settings2-data-preparing':'After data.png','settings2-data-email':'Third data.png','settings2-data-submitted':'Fourth data.png'}
THR={'settings2-data-email':90,'settings2-data-submitted':90}  # centre on the solid body, not the (asymmetric) glow
ONLY=sys.argv[2].split(',') if len(sys.argv)>2 else list(JOBS)

def bbox(img,bg,thr):
    d=np.abs(img.astype(int)-np.array(bg)).max(-1); ys,xs=np.where(d>thr); return xs.min(),xs.max(),ys.min(),ys.max()

def ring_median(img,w=10):
    r=np.concatenate([img[:w].reshape(-1,3),img[-w:].reshape(-1,3),img[:,:w].reshape(-1,3),img[:,-w:].reshape(-1,3)])
    return np.median(r,0)

def feather(h,w,edge=40):
    y=np.minimum(np.arange(h),np.arange(h)[::-1])[:,None]; x=np.minimum(np.arange(w),np.arange(w)[::-1])[None,:]
    t=np.clip(np.minimum(y,x)/edge,0,1); return t*t*(3-2*t)      # smoothstep 0 at the border -> 1 inside

def process(name,fn):
    a=np.array(Image.open(SRC+fn).convert('RGB'))
    L=a[:,:SEAM]; D=a[:,SEAM:]
    lb=bbox(L,L[5,5],THR.get(name,30)); db=bbox(D,D[5,5],THR.get(name,30))
    x0b,x1b=min(lb[0],db[0]),max(lb[1],db[1]); y0b,y1b=min(lb[2],db[2]),max(lb[3],db[3])
    cx,cy=(x0b+x1b)//2,(y0b+y1b)//2
    x0,y0=cx-S//2,cy-S//2
    print(name,'union bbox',(x0b,x1b,y0b,y1b),'center',(cx,cy),'crop origin',(x0,y0),'content w/h',x1b-x0b+1,y1b-y0b+1)
    assert x0>=0 and y0>=0 and x0+S<=SEAM and y0+S<=a.shape[0]
    # ---- LIGHT
    Lc=L[y0:y0+S,x0:x0+S].astype(float)
    bg=ring_median(Lc.astype(np.uint8)); gain=255.0/bg
    Lc=np.clip(Lc*gain,0,255)
    w=feather(S,S)[...,None]
    Lc=255-(255-Lc)*w                                    # pure white at the border, art untouched inside
    Image.fromarray(Lc.round().astype(np.uint8)).resize((OUTW,OUTW),Image.LANCZOS).save(OUT+name+'.png',optimize=True)
    # ---- DARK
    Dc=D[y0:y0+S,x0:x0+S].astype(float)
    bgd=ring_median(Dc.astype(np.uint8)); bgv=float(bgd.max())
    T=150.0
    al=np.clip((Dc.max(-1)-bgv)/(T-bgv),0,1)
    al[al<0.02]=0
    al*=feather(S,S)
    with np.errstate(divide='ignore',invalid='ignore'):
        col=np.where(al[...,None]>0,(Dc-(1-al[...,None])*bgv)/np.maximum(al[...,None],1e-6),0)
    col=np.clip(col,0,255)
    rgba=np.dstack([col,al*255]).round().astype(np.uint8)
    im=Image.fromarray(rgba).convert('RGBa').resize((OUTW,OUTW),Image.LANCZOS).convert('RGBA')
    im.save(OUT+name+'-dark.png',optimize=True)
    print('  bg light ring',bg.round(1).tolist(),'dark ring',bgd.tolist())

for n,f in JOBS.items():
    if n in ONLY: process(n,f)
