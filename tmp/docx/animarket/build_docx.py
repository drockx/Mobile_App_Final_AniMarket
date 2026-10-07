from pathlib import Path
import json
import re
import statistics
import pdfplumber
from pypdf import PdfReader
from pdf2image import convert_from_path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'output/pdf/AniMarket_Current_App_Documentation.pdf'
OUT = ROOT / 'output/documents/AniMarket_Current_App_Documentation.docx'
TMP = Path(__file__).parent
POPPLER = r'C:/Users/DELL/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin'
OUT.parent.mkdir(parents=True, exist_ok=True)

def font(run, size=None, bold=None, italic=None):
    run.font.name = 'Arial'
    run.font.color.rgb = RGBColor(0, 0, 0)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    rp = run._element.get_or_add_rPr()
    rf = rp.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rp.insert(0, rf)
    for k in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        rf.set(qn('w:'+k), 'Arial')
    for k in ('asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme'):
        rf.attrib.pop(qn('w:'+k), None)

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = sec.right_margin = Inches(.875)
sec.top_margin = Inches(.875)
sec.bottom_margin = Inches(.70)
sec.header_distance = Inches(.35)
sec.footer_distance = Inches(.35)
sec.different_first_page_header_footer = True
for style in doc.styles:
    for border in list(style.element.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
    if hasattr(style, 'font'):
        style.font.name = 'Arial'
        style.font.color.rgb = RGBColor(0,0,0)
        rf = style.element.get_or_add_rPr().find(qn('w:rFonts'))
        if rf is None:
            rf = OxmlElement('w:rFonts')
            style.element.get_or_add_rPr().insert(0, rf)
        for key in ('ascii','hAnsi','eastAsia','cs'):
            rf.set(qn('w:'+key), 'Arial')
        for key in ('asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme'):
            rf.attrib.pop(qn('w:'+key), None)

normal = doc.styles['Normal']
normal.font.size = Pt(11.3)
normal.paragraph_format.line_spacing = Pt(15.1)
normal.paragraph_format.space_after = Pt(7)
normal.paragraph_format.widow_control = True
for name, size, lead, after in [('Title',21,27,10),('Heading 1',15,19,10),('Heading 2',12,16,6)]:
    s = doc.styles[name]
    s.font.size = Pt(size)
    s.font.bold = True
    s.paragraph_format.line_spacing = Pt(lead)
    s.paragraph_format.space_before = Pt(0 if name != 'Heading 2' else 4)
    s.paragraph_format.space_after = Pt(after)
    s.paragraph_format.keep_with_next = True
    s.paragraph_format.keep_together = True
    s.paragraph_format.page_break_before = False

hp = sec.header.paragraphs[0]
hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
font(hp.add_run('AniMarket  |  Version 1.0.0'),8.7)
hp.paragraph_format.space_after = Pt(0)
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run()
font(r,10)
field = OxmlElement('w:fldSimple')
field.set(qn('w:instr'),'PAGE')
r._r.addnext(field)

def space(points):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing = Pt(points)
    font(p.add_run(''), 1)
    return p

def centered(text, size, bold=False, after=0, before=0, style=None):
    p = doc.add_paragraph(style=style)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = Pt(size+6)
    p.paragraph_format.keep_with_next = False
    font(p.add_run(text),size,bold)
    return p

seal = TMP/'school_seal.png'
seal.write_bytes(PdfReader(SOURCE).pages[0].images[0].data)
centered('ANIMARKET',21,True,after=11,before=9,style='Title')
centered('A MOBILE LIVESTOCK MARKETPLACE',14,True,after=0)
centered('FOR DAVAO DEL NORTE',14,True,after=15)
centered('Final Project Documentation',12,after=0)
centered('Version 1.0.0',12,after=55)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(13)
p.paragraph_format.line_spacing = 1.0
p.add_run().add_picture(str(seal),width=Inches(1.333))
centered('Department of Computing Education',12,after=0)
centered('UM Tagum College, Tagum City',12,after=27)
centered('CCE106 - APPLICATION DEVELOPMENT & EMERGING TECHNOLOGY',11.3,after=55)
centered('DWAYNE RUBITE',12,True,after=0)
centered('CHESTER EMUTAN',12,True,after=49)
centered('October 2026',12,after=0)
centered('Current app snapshot as of 7 October 2026',10.5)

diagrams = {5:(59,168.5,553,314.5),6:(59,557,553,633)}
diagram_files = {}
for num, box in diagrams.items():
    image = convert_from_path(str(SOURCE), dpi=240, first_page=num, last_page=num, poppler_path=POPPLER)[0]
    scale = 240/72
    crop = image.crop(tuple(round(v*scale) for v in box))
    path = TMP/f'figure_{num}.png'
    crop.save(path)
    diagram_files[num] = path

widths = {4:[44,114,328],5:[108,208,170],7:[216,270],8:[207,67,212],9:[46,114,226,100],11:[136,350]}
def add_table(source_table, page_num):
    rows = source_table.extract()
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.autofit = False
    for col, value in zip(t.columns,widths[page_num]):
        col.width = Pt(value)
    props = t._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for name in ('top','left','bottom','right','insideH','insideV'):
        edge = OxmlElement('w:'+name)
        edge.set(qn('w:val'),'single')
        edge.set(qn('w:sz'),'4')
        edge.set(qn('w:color'),'D9D9D9')
        borders.append(edge)
    props.append(borders)
    for ri, (row, values) in enumerate(zip(t.rows,rows)):
        trpr = row._tr.get_or_add_trPr()
        trpr.append(OxmlElement('w:cantSplit'))
        if ri == 0:
            trpr.append(OxmlElement('w:tblHeader'))
        for ci,(cell,value) in enumerate(zip(row.cells,values)):
            cell.width = Pt(widths[page_num][ci])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tc = cell._tc.get_or_add_tcPr()
            margins = OxmlElement('w:tcMar')
            for edge,size in [('top',75),('bottom',75),('left',140),('right',140)]:
                el = OxmlElement('w:'+edge)
                el.set(qn('w:w'),str(size)); el.set(qn('w:type'),'dxa')
                margins.append(el)
            tc.append(margins)
            if ri == 0:
                sh = OxmlElement('w:shd'); sh.set(qn('w:fill'),'E8E8E8'); tc.append(sh)
            text = (value or '').replace('/\n','/')
            text = re.sub(r'\s*\n\s*',' ',text)
            para = cell.paragraphs[0]
            para.paragraph_format.space_before = Pt(0)
            para.paragraph_format.space_after = Pt(0)
            para.paragraph_format.line_spacing = Pt(13.1)
            para.paragraph_format.keep_with_next = False
            para.paragraph_format.widow_control = False
            font(para.add_run(text),10.2,ri==0)
    return t

def inside(char,box):
    midx = (char['x0']+char['x1'])/2
    midy = (char['top']+char['bottom'])/2
    return box[0] <= midx <= box[2] and box[1] <= midy <= box[3]

def lines_for(page, exclusions):
    groups = {}
    for c in page.chars:
        if c['top']<60 or c['top']>741 or any(inside(c,b) for b in exclusions):
            continue
        key = round(c['matrix'][5],2)
        groups.setdefault(key,[]).append(c)
    lines=[]
    for baseline,chars in groups.items():
        chars.sort(key=lambda c:c['x0'])
        text=''.join(c['text'] for c in chars).strip()
        if text:
            lines.append({'top':min(c['top'] for c in chars),'baseline':baseline,'text':text,'size':round(statistics.median(c['size'] for c in chars),1),'chars':chars})
    return sorted(lines,key=lambda x:x['top'])

def append_chars(para,chars):
    current=None
    run=None
    for c in chars:
        key=('Bold' in c['fontname'],'Italic' in c['fontname'])
        if key!=current:
            run=para.add_run(); font(run,bold=key[0],italic=key[1]); current=key
        run.text += c['text']

def add_group(group,page_num):
    first=group[0]
    txt=first['text']
    size=first['size']
    if page_num==2:
        if size==15 or size==12:
            para=doc.add_paragraph(style='Heading 1' if size==15 else 'Heading 2')
            para.add_run(txt)
        else:
            left,number=txt.rsplit(' ',1)
            para=doc.add_paragraph()
            para.paragraph_format.tab_stops.add_tab_stop(Inches(6.75),WD_TAB_ALIGNMENT.RIGHT)
            para.paragraph_format.space_after=Pt(3)
            para.paragraph_format.line_spacing=Pt(17)
            font(para.add_run(left+'\t'+number),11.2)
        return
    if size==15:
        para=doc.add_paragraph(style='Heading 1')
    elif size==12:
        para=doc.add_paragraph(style='Heading 2')
    else:
        para=doc.add_paragraph()
        para.paragraph_format.line_spacing=Pt(14 if size<11 else 15.1)
        para.paragraph_format.space_after=Pt(7)
        if txt.startswith('CHAPTER '):
            para.paragraph_format.keep_with_next=True
            para.paragraph_format.space_after=Pt(5)
        if txt.startswith('Table ') or txt.startswith('Figure '):
            para.paragraph_format.space_before=Pt(3)
            para.paragraph_format.space_after=Pt(7)
            para.paragraph_format.keep_with_next=txt.startswith('Table ')
    metadata=txt.startswith('Project:')
    numbered=bool(re.match(r'^1\. ',txt))
    for idx,line in enumerate(group):
        if idx:
            force=metadata or (numbered and bool(re.match(r'^\d\. ',line['text']))) or line['text'].startswith('https://')
            if force: para.add_run().add_break()
            else: para.add_run(' ')
        append_chars(para,line['chars'])
    for run in para.runs:
        font(run,size)

def contents():
    doc.add_paragraph('Table of Contents',style='Heading 1')
    groups = [
        (None,[('Chapter 1  Introduction and project overview',3),('Requirements',4),('Chapter 2  Architecture and technology stack',5),('Design and user interface',6),('Database design',7),('API design and development process',8),('Chapter 3  Testing',9),('Deployment and user acceptance',10),('Maintenance and conclusion',11),('References',12)]),
        ('List of Tables',[('Table 1  Functional requirements',4),('Table 2  Technology stack',5),('Table 3  Primary data collections',7),('Table 4  Trusted API interfaces',8),('Table 5  Key test cases and evidence',9),('Table 6  Maintenance plan',11)]),
        ('List of Figures',[('Figure 1  AniMarket system architecture',5),('Figure 2  Order lifecycle',6)]),
    ]
    for heading,rows in groups:
        if heading:
            space(10)
            doc.add_paragraph(heading,style='Heading 2')
        for label,number in rows:
            p=doc.add_paragraph()
            p.paragraph_format.tab_stops.add_tab_stop(Inches(6.75),WD_TAB_ALIGNMENT.RIGHT)
            p.paragraph_format.space_after=Pt(3)
            p.paragraph_format.line_spacing=Pt(17)
            font(p.add_run(label+'\t'+str(number)),11.2)

document_structure=[]
with pdfplumber.open(SOURCE) as pdf:
    for page_num,page in enumerate(pdf.pages,start=1):
        if page_num==1: continue
        doc.add_page_break()
        if page_num==2:
            contents()
            continue
        source_tables=page.find_tables() if page_num in widths else []
        exclusions=[t.bbox for t in source_tables]
        if page_num in diagrams: exclusions.append(diagrams[page_num])
        lines=lines_for(page,exclusions)
        events=[]
        pending=[]
        for line in lines:
            if pending:
                prev=pending[-1]
                gap=prev['baseline']-line['baseline']
                is_heading=line['size']>=12 or line['text'].startswith('CHAPTER ')
                joins=(abs(line['size']-prev['size'])<.1 and gap<=17 and not is_heading and prev['size']<12)
                if not joins:
                    events.append((pending[0]['top'],'paragraph',pending)); pending=[]
            pending.append(line)
        if pending: events.append((pending[0]['top'],'paragraph',pending))
        for t in source_tables: events.append((t.bbox[1],'table',t))
        if page_num in diagrams: events.append((diagrams[page_num][1],'diagram',page_num))
        events.sort(key=lambda e:e[0])
        for top,kind,value in events:
            if kind=='paragraph': add_group(value,page_num)
            elif kind=='table':
                add_table(value,page_num)
                p=space(5)
            elif kind=='diagram':
                p=doc.add_paragraph()
                p.paragraph_format.space_after=Pt(3)
                p.paragraph_format.space_before=Pt(0)
                p.paragraph_format.line_spacing=1.0
                p.add_run().add_picture(str(diagram_files[page_num]),width=Inches(6.75))
        document_structure.append({'page':page_num,'tables':len(source_tables),'paragraph_groups':sum(e[1]=='paragraph' for e in events),'diagram':page_num in diagrams})

doc.core_properties.title='AniMarket Current App Documentation Version 1.0.0'
doc.core_properties.author='Dwayne Rubite and Chester Emutan'
doc.core_properties.subject='Current application documentation as of 7 October 2026'
doc.save(OUT)
print(json.dumps({'file':str(OUT),'tables':len(doc.tables),'inline_images':len(doc.inline_shapes),'structure':document_structure},indent=2))
