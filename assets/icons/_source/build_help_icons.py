# Crops the three "Help Zelo get smarter" bullet icons (chat bubble, crossed eye, gear) out of the
# user's light|dark reference sheet assets/icons/settings/"icons for chat help ref.png".
# One crop rectangle per icon shared by both halves (theme swap can't shift it), centred on the
# union of the two halves' solid bodies (thr 90 ignores the glow/ground shadow when centring).
# LIGHT: colour-to-alpha against white (the icons sit on a pale-pink card, so an opaque crop would
#        show a white box; the art is very pale so saturation segmentation fails — colour-to-alpha
#        composites back to the original over pure white and adapts over a tinted card).
# DARK:  real alpha from black incl. glow, bg-offset-aware (same as build_data_icons.py).
import numpy as np, sys
from PIL import Image
SRC='/Volumes/PBE Main HD/VSC/ChatPracticeWeb/assets/icons/settings/icons for chat help ref.png'
OUT=sys.argv[1]
SEAM=1086; S=340; OUTW=170
NAMES=['settings2-help-chat','settings2-help-eye','settings2-help-gear']

def bbox_groups(img,bg,thr=90,mingap=60):
    d=np.abs(img.astype(int)-np.array(bg)).max(-1)>thr
    xs=np.where(d.any(0))[0]; gs=[]; s=p=xs[0]
    for x in xs[1:]:
        if x-p>mingap: gs.append((s,p)); s=x
        p=x
    gs.append((s,p)); out=[]
    for x0,x1 in gs:
        ys=np.where(d[:,x0:x1+1].any(1))[0]; out.append((x0,x1,ys.min(),ys.max()))
    return out
def ring_median(img,w=10):
    r=np.concatenate([img[:w].reshape(-1,3),img[-w:].reshape(-1,3),img[:,:w].reshape(-1,3),img[:,-w:].reshape(-1,3)])
    return np.median(r,0)
def feather(h,w,edge=30):
    y=np.minimum(np.arange(h),np.arange(h)[::-1])[:,None]; x=np.minimum(np.arange(w),np.arange(w)[::-1])[None,:]
    t=np.clip(np.minimum(y,x)/edge,0,1); return t*t*(3-2*t)

a=np.array(Image.open(SRC).convert('RGB'))
L=a[:,:SEAM]; D=a[:,SEAM:]
lg=bbox_groups(L,L[5,5]); dg=bbox_groups(D,D[5,5])
assert len(lg)==3 and len(dg)==3
for name,lb,db in zip(NAMES,lg,dg):
    x0b,x1b=min(lb[0],db[0]),max(lb[1],db[1]); y0b,y1b=min(lb[2],db[2]),max(lb[3],db[3])
    cx,cy=(x0b+x1b)//2,(y0b+y1b)//2; x0,y0=cx-S//2,cy-S//2
    assert x0>=0 and y0>=0 and x0+S<=SEAM and y0+S<=a.shape[0],(name,x0,y0)
    print(name,'body bbox',(x0b,x1b,y0b,y1b),'crop origin',(x0,y0))
    # ---- LIGHT: colour-to-alpha vs white
    Lc=L[y0:y0+S,x0:x0+S].astype(float)
    bg=ring_median(Lc.astype(np.uint8)); Lc=np.clip(Lc*(255.0/bg),0,255)
    m=Lc.min(-1); al=1-m/255.0
    al=np.clip((al-0.03)/0.97,0,1); al[al<0.004]=0
    al*=feather(S,S)
    with np.errstate(divide='ignore',invalid='ignore'):
        col=np.where(al[...,None]>0,255-(255-Lc)/np.maximum(al[...,None],1e-6),0)
    col=np.clip(col,0,255)
    im=Image.fromarray(np.dstack([col,al*255]).round().astype(np.uint8)).convert('RGBa').resize((OUTW,OUTW),Image.LANCZOS).convert('RGBA')
    im.save(OUT+name+'.png',optimize=True)
    # ---- DARK
    Dc=D[y0:y0+S,x0:x0+S].astype(float)
    bgd=ring_median(Dc.astype(np.uint8)); bgv=float(bgd.max()); T=150.0
    al=np.clip((Dc.max(-1)-bgv)/(T-bgv),0,1); al[al<0.02]=0; al*=feather(S,S)
    with np.errstate(divide='ignore',invalid='ignore'):
        col=np.where(al[...,None]>0,(Dc-(1-al[...,None])*bgv)/np.maximum(al[...,None],1e-6),0)
    col=np.clip(col,0,255)
    Image.fromarray(np.dstack([col,al*255]).round().astype(np.uint8)).convert('RGBa').resize((OUTW,OUTW),Image.LANCZOS).convert('RGBA').save(OUT+name+'-dark.png',optimize=True)
