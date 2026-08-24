"""Extract verbatim clinical text from index.html into a structured JSON tree.

Preserves: rendered text (browser whitespace collapsing), bold/italic emphasis,
link targets, source-citation tags, table structure, and callout-box framing.
"""
import json, re, sys
from html.parser import HTMLParser

VOID = {'br','hr','img','input','meta','link','source','area','base','col','embed','param','track','wbr'}

class Node:
    __slots__ = ('tag','attrs','children','parent','text')
    def __init__(self, tag, attrs=None, parent=None):
        self.tag=tag; self.attrs=attrs or {}; self.children=[]; self.parent=parent; self.text=None
    def cls(self): return set((self.attrs.get('class') or '').split())
    def id(self): return self.attrs.get('id','')

class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root'); self.cur = self.root
    def handle_starttag(self, tag, attrs):
        n = Node(tag, dict(attrs), self.cur); self.cur.children.append(n)
        if tag not in VOID: self.cur = n
    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, dict(attrs), self.cur))
    def handle_endtag(self, tag):
        if tag in VOID: return
        n = self.cur
        while n is not self.root and n.tag != tag: n = n.parent
        if n is not self.root: self.cur = n.parent
    def handle_data(self, data):
        n = Node('#text', {}, self.cur); n.text = data; self.cur.children.append(n)

def ws(s): return re.sub(r'[ \t\r\n]+', ' ', s)

BOLD = {'strong','b','th'}
ITAL = {'em','i'}

def runs_of(node, cites, bold=False, ital=False, out=None):
    """Rendered inline runs of a subtree, carrying emphasis; citations pulled aside."""
    out = out if out is not None else []
    for ch in node.children:
        if ch.tag == '#text':
            out.append({'t': ws(ch.text), 'b': bold, 'i': ital})
        elif ch.tag == 'br':
            out.append({'t':'\n','b':bold,'i':ital})
        elif ch.tag in ('script','style'):
            continue
        elif ch.tag == 'span' and 'src-tag' in ch.cls():
            c = ''.join(r['t'] for r in runs_of(ch, [])).strip()
            c = re.sub(r'\s+',' ', c)
            if c: cites.append(c)
        elif ch.tag == 'a':
            runs_of(ch, cites, bold, ital, out)
            href = ch.attrs.get('href','')
            if href.startswith('http'):
                out.append({'t': f' <{href}>', 'b':False, 'i':False, 'url':True})
        else:
            runs_of(ch, cites, bold or ch.tag in BOLD, ital or ch.tag in ITAL, out)
    return out

def tidy(runs):
    """Trim and merge runs; drop empties. Mirrors what a reader actually sees."""
    merged=[]
    for r in runs:
        if merged and merged[-1]['b']==r['b'] and merged[-1]['i']==r['i'] and not r.get('url') and not merged[-1].get('url'):
            merged[-1]['t'] += r['t']
        else:
            merged.append(dict(r))
    # collapse space around newlines, strip ends
    for r in merged: r['t'] = re.sub(r' *\n *','\n', r['t'])
    while merged and not merged[0]['t'].strip(): merged.pop(0)
    while merged and not merged[-1]['t'].strip(): merged.pop()
    if merged:
        merged[0]['t'] = merged[0]['t'].lstrip()
        merged[-1]['t'] = merged[-1]['t'].rstrip()
    merged = [r for r in merged if r['t']]
    # squeeze blank lines
    txt = ''.join(r['t'] for r in merged)
    if not txt.strip(): return []
    return merged

def plain(runs): return ''.join(r['t'] for r in runs)

SKIP_CLASS = {'tab-buttons','button-container','button-group','gate-buttons','type-legend',
              'scale-choice','severity-group','type-group','form-grid','results-grid','std-drinks-grid'}
SKIP_TAG = {'script','style','svg','select','input','textarea','nav'}
BOX = {'warning-box':'WARNING','danger-box':'DANGER','info-box':'INFO'}
HEADINGS = {'h1':1,'h2':2,'h3':3,'h4':4,'h5':5,'h6':6}
BLOCK_TEXT = {'p','li','dd','dt','blockquote','figcaption','summary'}
INLINE_TAGS = {'#text','strong','b','em','i','span','a','code','sup','sub','abbr','small','br','button'}

def table_rows(tbl):
    rows=[]
    def w(n):
        if n.tag=='tr':
            cells=[]
            for c in n.children:
                if c.tag in ('td','th'):
                    cites=[]; r=tidy(runs_of(c,cites,bold=(c.tag=='th')))
                    cells.append({'runs':r,'cites':cites,'header':c.tag=='th'})
            if cells: rows.append(cells)
            return
        for c in n.children: w(c)
    w(tbl)
    return rows

def walk(node, out, box=None, skip_marked=False):
    pending=[]   # consecutive inline children -> one paragraph
    def flush():
        nonlocal pending
        if pending:
            cites=[]; rr=[]
            for p in pending: runs_of(Wrap(p), cites, out=rr)
            t=tidy(rr)
            if t: out.append({'kind':'para','runs':t,'cites':cites,'box':box})
            pending=[]
    for ch in node.children:
        if skip_marked and ch.attrs.get('__skip'): flush(); continue
        if ch.tag in SKIP_TAG: continue
        c = ch.cls()
        if c & SKIP_CLASS: continue
        if ch.tag=='button': continue
        if ch.tag in INLINE_TAGS:
            # Whitespace between two inline elements ("</b> <b>") is a real space
            # in the rendered page; only leading whitespace is discardable.
            if ch.tag=='#text' and not ch.text.strip() and not pending: continue
            pending.append(ch); continue
        flush()
        if ch.tag in HEADINGS:
            cites=[]; t=tidy(runs_of(ch,cites))
            if t: out.append({'kind':'heading','level':HEADINGS[ch.tag],'runs':t,'cites':cites,'box':box})
        elif ch.tag=='table':
            rows=table_rows(ch)
            if rows: out.append({'kind':'table','rows':rows,'box':box})
        elif ch.tag in BLOCK_TEXT:
            cites=[]; t=tidy(runs_of(ch,cites))
            if t: out.append({'kind':'li' if ch.tag=='li' else 'para','runs':t,'cites':cites,'box':box})
        else:
            nb=box
            for k,label in BOX.items():
                if k in c: nb=label
            has_marked = skip_marked and bool(find_all(ch, lambda n: bool(n.attrs.get('__skip'))))
            walk(ch, out, nb, skip_marked=has_marked or skip_marked)
    flush()

class Wrap:
    def __init__(self,n): self.children=[n]

CLINICAL_PAGES = ['inpatient-guidelines-page','ambulatory-guidelines-page','scales-page',
    'opioid-withdrawal-page','benzo-withdrawal-page','cannabis-withdrawal-page',
    'stimulant-withdrawal-page','gabapentinoid-withdrawal-page','ghb-withdrawal-page',
    'nicotine-withdrawal-page','volatile-withdrawal-page','capacity-page','populations-page',
    'screening-page','bbv-sti-page','continuing-care-page','contacts-page']
EXTRA = ['criteria-modal','disclaimer-modal']

def find_all(node,pred,acc=None):
    acc = acc if acc is not None else []
    if pred(node): acc.append(node)
    for ch in node.children: find_all(ch,pred,acc)
    return acc

TAB_LABELS = {}
def tab_labels(page):
    """Human tab names from the tab bar, so a tab is titled as the user sees it."""
    m={}
    for btn in find_all(page, lambda n: n.tag=='button' and 'tab-button' in n.cls()):
        full = find_all(btn, lambda n: n.tag=='span' and 'tab-label-full' in n.cls())
        src = full[0] if full else btn
        label = re.sub(r'\s+',' ', ''.join(r['t'] for r in runs_of(src,[]))).strip()
        m[btn.attrs.get('data-tab','')] = label
    return m

def main(path, outp):
    b=Builder(); b.feed(open(path,encoding='utf-8').read())
    result=[]
    for node in find_all(b.root, lambda n: n.tag=='div' and ('page' in n.cls() or n.id() in EXTRA)):
        pid=node.id()
        if pid not in CLINICAL_PAGES and pid not in EXTRA: continue
        title=node.attrs.get('data-title') or pid
        tabs=find_all(node, lambda n: n.tag=='div' and 'tab-content' in n.cls())
        labels=tab_labels(node)
        sections=[]
        if tabs:
            for t in tabs: t.attrs['__skip']='1'
            pre=[]; walk(node,pre,skip_marked=True)
            if pre: sections.append({'tab':None,'blocks':pre})
            for t in tabs:
                t.attrs.pop('__skip',None)
                blocks=[]; walk(t,blocks)
                if blocks: sections.append({'tab':labels.get(t.id(), t.id()),'tab_id':t.id(),'blocks':blocks})
        else:
            blocks=[]; walk(node,blocks)
            sections.append({'tab':None,'blocks':blocks})
        result.append({'page_id':pid,'title':title,'sections':sections})
    json.dump(result, open(outp,'w'), indent=1, ensure_ascii=False)
    tot=0
    for p in result:
        n=sum(len(s['blocks']) for s in p['sections']); tot+=n
        print(f"  {p['page_id']:38s} sections={len(p['sections']):2d} blocks={n}")
    print("TOTAL blocks:", tot)

if __name__=='__main__': main(sys.argv[1], sys.argv[2])
