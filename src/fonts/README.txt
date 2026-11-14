Put these font files in this folder so PDFs can print Tamil and Hindi names (they are free, open licence):
  NotoSans-Regular.ttf
  NotoSans-Bold.ttf
  NotoSansTamil-Regular.ttf
  NotoSansDevanagari-Regular.ttf
Download them from fonts.google.com (search "Noto Sans", "Noto Sans Tamil", "Noto Sans Devanagari"; choose Download family
and copy the regular and bold .ttf files, renamed as above).
Another script (Telugu, Kannada, Malayalam, Bengali...) needs its own Noto font and a small addition in src/lib/pdf.ts.
Without these files the PDFs still work, but characters outside English print as "?".
