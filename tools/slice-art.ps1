# Slices the 2x2 Gemini sheet into king/queen/jack/back PNGs,
# removes the paper background by flood-filling in from the borders,
# trims to the artwork bounds and downscales.
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public static class ArtCut {
  // Flood fill transparency inward from the image border.
  // seedBottom=false leaves the bottom edge alone (court figures are cropped flush at the waist).
  public static Bitmap KeyOut(Bitmap src, int tol, bool seedBottom) {
    int w = src.Width, h = src.Height;
    Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);

    BitmapData bd = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = bd.Stride;
    byte[] buf = new byte[stride * h];
    System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, buf, 0, buf.Length);

    // background colour = average of the four corners
    int[] cx = { 2, w-3, 2, w-3 };
    int[] cy = { 2, 2, h-3, h-3 };
    int br=0, bg2=0, bb=0;
    for (int i=0;i<4;i++){ int o = cy[i]*stride + cx[i]*4; bb+=buf[o]; bg2+=buf[o+1]; br+=buf[o+2]; }
    br/=4; bg2/=4; bb/=4;

    bool[] seen = new bool[w*h];
    Stack<int> st = new Stack<int>();
    Action<int,int> push = (x,y) => {
      if (x<0||y<0||x>=w||y>=h) return;
      int idx = y*w+x; if (seen[idx]) return;
      int o = y*stride + x*4;
      int dr = buf[o+2]-br, dg = buf[o+1]-bg2, db = buf[o]-bb;
      if (dr*dr+dg*dg+db*db > tol*tol) return;
      seen[idx]=true; st.Push(idx);
    };

    for (int x=0;x<w;x++){ push(x,0); if (seedBottom) push(x,h-1); }
    for (int y=0;y<h;y++){ push(0,y); push(w-1,y); }

    while (st.Count>0) {
      int idx = st.Pop(); int x = idx%w, y = idx/w;
      buf[y*stride + x*4 + 3] = 0;               // alpha = 0
      push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
    }

    System.Runtime.InteropServices.Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
    bmp.UnlockBits(bd);
    return bmp;
  }

  // Bounding box of pixels with alpha above a threshold.
  public static int[] Bounds(Bitmap bmp, int alphaMin) {
    int w = bmp.Width, h = bmp.Height;
    BitmapData bd = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = bd.Stride;
    byte[] buf = new byte[stride*h];
    System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, buf, 0, buf.Length);
    bmp.UnlockBits(bd);
    int x0=w, y0=h, x1=-1, y1=-1;
    for (int y=0;y<h;y++) for (int x=0;x<w;x++) {
      if (buf[y*stride+x*4+3] > alphaMin) {
        if (x<x0) x0=x; if (x>x1) x1=x; if (y<y0) y0=y; if (y>y1) y1=y;
      }
    }
    if (x1<0) return new int[]{0,0,w,h};
    return new int[]{x0, y0, x1-x0+1, y1-y0+1};
  }
}
"@ -ReferencedAssemblies System.Drawing, System.Drawing.Primitives

function Export-Part {
  param($Sheet, $Col, $Row, $Name, $TargetW, $Tol, $SeedBottom)
  $qw = [int]($Sheet.Width/2); $qh = [int]($Sheet.Height/2)
  $rect = New-Object Drawing.Rectangle ($Col*$qw), ($Row*$qh), $qw, $qh
  $quad = $Sheet.Clone($rect, [Drawing.Imaging.PixelFormat]::Format32bppArgb)

  $keyed = [ArtCut]::KeyOut($quad, $Tol, $SeedBottom)
  $b = [ArtCut]::Bounds($keyed, 8)
  $crop = New-Object Drawing.Rectangle $b[0], $b[1], $b[2], $b[3]
  $trimmed = $keyed.Clone($crop, [Drawing.Imaging.PixelFormat]::Format32bppArgb)

  $scale = $TargetW / $trimmed.Width
  $nw = [int]$TargetW; $nh = [int][Math]::Round($trimmed.Height*$scale)
  $out = New-Object Drawing.Bitmap $nw, $nh, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode  = 'HighQuality'
  $g.DrawImage($trimmed, 0, 0, $nw, $nh)
  $g.Dispose()

  $path = Join-Path (Get-Location) "art\$Name.png"
  $out.Save($path, [Drawing.Imaging.ImageFormat]::Png)
  "{0,-6} {1,4}x{2,-4} -> {3}x{4}  {5} KB" -f $Name, $b[2], $b[3], $nw, $nh, [int]((Get-Item $path).Length/1KB)
  $quad.Dispose(); $keyed.Dispose(); $trimmed.Dispose(); $out.Dispose()
}

$src = Get-Item "art\source\gemini-sheet.jpg"
$sheet = [Drawing.Bitmap]::FromFile($src.FullName)
"sheet: $($sheet.Width)x$($sheet.Height)"

Export-Part $sheet 0 0 "king"  400 34 $false
Export-Part $sheet 1 0 "queen" 400 34 $false
Export-Part $sheet 0 1 "jack"  400 34 $false
Export-Part $sheet 1 1 "back"  320 34 $true

$sheet.Dispose()
