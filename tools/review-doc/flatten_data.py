"""Flatten the app's clinical data modules into the same block structure as the
static HTML extraction, so both feed one review document."""
import json, os, re, sys
import extract_html as E

def frag(html):
    """Parse an HTML fragment string from a data module into blocks."""
    if html is None: return []
    b = E.Builder(); b.feed(str(html))
    blocks = []; E.walk(b.root, blocks)
    return blocks

def para(text_html, box=None):
    bl = frag(text_html)
    for x in bl:
        if box and not x.get('box'): x['box'] = box
    return bl

def plain_runs(s, bold=False):
    return [{'t': s, 'b': bold, 'i': False}]

def P(s, bold=False, box=None, kind='para'):
    return {'kind':kind,'runs':plain_runs(s,bold),'cites':[],'box':box}

def H(s, level=4):
    return {'kind':'heading','level':level,'runs':plain_runs(s),'cites':[]}

def table(rows_of_html, header=None):
    rows=[]
    if header:
        rows.append([{'runs':plain_runs(h,True),'cites':[],'header':True} for h in header])
    for r in rows_of_html:
        cells=[]
        for c in r:
            cites=[]; bb=E.Builder(); bb.feed(str(c))
            runs=E.tidy(E.runs_of(bb.root,cites))
            cells.append({'runs':runs,'cites':cites,'header':False})
        rows.append(cells)
    return {'kind':'table','rows':rows,'box':None}

WORK = os.environ.get('WORK_DIR', '.')
d = json.load(open(os.path.join(WORK, 'data.json')))
SEV = json.load(open(os.path.join(WORK, 'severity.json')))
out = []   # list of {page_id, title, attach_to, blocks}

def sec(page_id, title, attach_to, blocks):
    if blocks: out.append({'page_id':page_id,'title':title,'attach_to':attach_to,'blocks':blocks})

# ---- 1. Decision flowchart --------------------------------------------------
b=[]
b.append(P('Each node below is one screen of the interactive flowchart. "Options" are the '
           'answer buttons shown to the user; "EMR summary" is the text the app offers for '
           'pasting into the medical record.'))
for key, node in d['FLOWCHART_LOGIC'].items():
    b.append(H(f"{node.get('title','')}  —  {node.get('type','')}  [{key}]", 5))
    for line in str(node.get('text','')).split('\n'):
        if line.strip(): b.append(P(line.strip()))
    for opt in node.get('options',[]) or []:
        b.append({'kind':'li','runs':plain_runs(f"Option: {opt.get('label','')} → {opt.get('next_step','')}"),'cites':[]})
    if node.get('emr_summary'):
        b.append(P('EMR summary: ' + node['emr_summary']))
sec('alcohol-withdrawal-page','Alcohol Withdrawal Decision Flowchart',None,b)

# ---- 2. Inpatient regimens --------------------------------------------------
b=[]
b.append(P('The Regimens tab renders a schedule chosen by drug, regimen type and expected '
           'severity. Every combination the app can produce is listed below.'))
b.append(P(f"Initial scoring interval: {d['INITIAL_SCORING_INTERVAL']}"))
for label, line in d['EMR_SAFETY_LINES'].items():
    b.append(P(f"Safety line ({label}): {line}"))
ORDER = ['submild','mild','moderate','severe','symptom','loading','unknown']
for drug, cfg in d['REGIMEN_CONFIG'].items():
    b.append(H(f"{cfg.get('name',drug)} — maximum before review: {cfg.get('reviewMax','—')}", 4))
    for key in ORDER:
        r = cfg.get(key)
        if not isinstance(r, dict): continue
        b.append(H(f"{cfg.get('name',drug)} → {r.get('name',key)}", 5))
        if r.get('band'):
            b.append(P(f"Band: CIWA-Ar {r['band'].get('ciwa','—')} / AWS {r['band'].get('aws','—')}"))
        if r.get('monitoring'):
            b.append(P(f"Monitoring frequency: {r['monitoring']}"))
        for c in r.get('caveat',[]) or []:
            b.extend(para(c, box='CAVEAT'))
        for f, lbl in (('routing','Routing'), ('setting','Setting')):
            xs = r.get(f,[]) or []
            if xs: b.append(H(lbl, 6))
            for x in xs:
                b.extend(para(str(x)))
        for bd in r.get('bands',[]) or []:
            if isinstance(bd, dict):
                parts=[f"{k}: {v}" for k,v in bd.items() if not isinstance(v,(dict,list))]
                b.append({'kind':'li','runs':plain_runs('; '.join(parts)),'cites':[]})
        sched = r.get('schedule') or []
        if sched:
            cap = str(r.get('scheduleHeading') or 'Schedule')
            if all(isinstance(x,dict) for x in sched):
                keys=[]
                for x in sched:
                    for k in x:
                        if k not in keys: keys.append(k)
                hdr={'dose':'Dose (mg)','freq':'Frequency','note':'Note','day':'Day','time':'Time'}
                t=table([[str(x.get(k,'')) for k in keys] for x in sched],
                        header=[hdr.get(k,k) for k in keys])
                t['caption']=cap; b.append(t)
            else:
                b.append(P(cap + ':', bold=True))
                for x in sched: b.extend(para(str(x)))
        prn = r.get('prn') or []
        if prn:
            dicts = [x for x in prn if isinstance(x, dict)]
            if not dicts: b.append(P('PRN (as-needed) doses:', bold=True))
            for x in prn:
                if not isinstance(x, dict): b.extend(para(str(x)))
            if dicts:
                keys = []
                for x in dicts:
                    for k in x:
                        if k not in keys: keys.append(k)
                hdr = {'range':'CIWA-Ar score','aws':'AWS score','dose':'PRN dose (mg)'}
                t=table([[str(x.get(k,'')) for k in keys] for x in dicts],
                        header=[hdr.get(k,k) for k in keys])
                t['caption']='PRN (as-needed) doses'; b.append(t)
        for x in r.get('notes',[]) or []:
            b.extend(para(str(x)))
sec('inpatient-guidelines-page','Regimens (generated by the app)','3. Regimens',b)

# ---- 3. Scales & calculators ------------------------------------------------
b=[]
b.append(P('Each calculator below is generated from the app\'s scale data: the items a '
           'clinician scores, the wording of every option, and the score attached to it.'))
for c in d['SCALE_CAVEATS_UNIVERSAL']:
    b.extend(para(c, box='CAVEAT (all scales)'))
for sc in d['SCALES']:
    b.append(H(sc.get('name', sc.get('id','')), 4))
    if sc.get('reference'): b.append(P(f"Reference: {sc['reference']}"))
    if sc.get('note'): b.extend(para(str(sc['note'])))
    for c in sc.get('caveats',[]) or []:
        b.extend(para(c, box='CAVEAT'))
    sv = SEV.get(sc.get('id'))
    if sv and sv.get('bands'):
        labels = {x['label'] for x in sv['bands']}
        if labels == {'N/A'}:
            b.append(P(f"No severity band is displayed for this scale; the app shows \"N/A\". Maximum attainable score {sv['max']}."))
        else:
            t=table([[(str(x['from']) if x['from']==x['to'] else f"{x['from']}-{x['to']}"), x['label']]
                     for x in sv['bands']], header=['Total score','Severity displayed'])
            t['caption']=f"Severity band shown beside the total score (maximum attainable score {sv['max']})"
            b.append(t)
    for it in sc.get('items',[]) or []:
        b.append(H(str(it.get('displayName','')), 5))
        if it.get('instruction'): b.extend(para(str(it['instruction'])))
        if it.get('description'): b.extend(para(str(it['description'])))
        rows=[]
        for o in it.get('options',[]) or []:
            if isinstance(o,dict):
                rows.append([str(o.get('score', o.get('value',''))), str(o.get('text', o.get('label','')))])
        if rows:
            t=table(rows, header=['Score','Option wording']); t['caption']='Scoring options'; b.append(t)
    for key,label in (('scoring','Scoring'),('interpretation','Interpretation'),('bands','Severity bands'),('severity','Severity')):
        v = sc.get(key)
        if not v: continue
        b.append(P(label+':', bold=True))
        if isinstance(v,list):
            for x in v:
                if isinstance(x,dict):
                    b.append({'kind':'li','runs':plain_runs('; '.join(f'{k}: {vv}' for k,vv in x.items())),'cites':[]})
                else: b.extend(para(str(x)))
        elif isinstance(v,dict):
            for k,vv in v.items(): b.append({'kind':'li','runs':plain_runs(f'{k}: {vv}'),'cites':[]})
        else: b.extend(para(str(v)))
sec('scales-page','Calculators (generated by the app)',None,b)

# ---- 4. Symptomatic medications --------------------------------------------
SUB_PAGE = {'opioid':'opioid-withdrawal-page','cannabis':'cannabis-withdrawal-page',
            'gabapentinoid':'gabapentinoid-withdrawal-page','psychostimulant':'stimulant-withdrawal-page',
            'benzodiazepine':'benzo-withdrawal-page','ghb':'ghb-withdrawal-page','alcohol':'inpatient-guidelines-page'}
UNIV=[]
for x in d['SYMPTOMATIC_UNIVERSAL']: UNIV.extend(para(x, box='APPLIES TO EVERY SUBSTANCE'))
for subst, blockdef in d['SYMPTOMATIC'].items():
    b=list(UNIV)
    b.insert(0, P(str(blockdef.get('title','')), bold=True))
    for it in blockdef.get('items',[]) or []:
        b.append(H(str(it.get('symptom','')), 5))
        for line in it.get('lines',[]) or []:
            b.extend(para(str(line)))
    sec(SUB_PAGE.get(subst, subst), 'Symptomatic medications (generated by the app)', None, b)

# ---- 5. Harm reduction ------------------------------------------------------
for subst, blocks in d['HARM_REDUCTION'].items():
    b=[]
    for blk in blocks:
        b.append(H(str(blk.get('heading','')), 5))
        for pt in blk.get('points',[]) or []:
            bl = frag(str(pt))
            for x in bl:
                x['kind']='li'
                if blk.get('danger'): x['box']='DANGER'
            b.extend(bl)
        if blk.get('source'):
            cites=[]; bb=E.Builder(); bb.feed(str(blk['source']))
            E.runs_of(bb.root, cites)
            if cites: b.append({'kind':'para','runs':[],'cites':cites,'box':None})
    attach = 'Harm Reduction' if subst=='alcohol' else None
    sec(SUB_PAGE.get(subst, subst), 'Harm reduction (generated by the app)', attach, b)

# ---- 6. Benzodiazepine equivalence -----------------------------------------
b=[P(f"All values are milligrams equivalent to diazepam {d['DIAZEPAM_REFERENCE_MG']} mg.")]
b.append(table([[r['drug'], f"{r['mg']} mg"] for r in d['BENZO_EQUIVALENCE']],
               header=['Drug', f"Dose equivalent to diazepam {d['DIAZEPAM_REFERENCE_MG']} mg"]))
for c in d['EQUIVALENCE_CAVEATS']: b.extend(para(str(c), box='CAVEAT'))
sec('benzo-withdrawal-page','Benzodiazepine / z-drug equivalence (generated by the app)',None,b)

json.dump(out, open(os.path.join(WORK,'generated.json'),'w'), indent=1, ensure_ascii=False)
print(f"generated sections: {len(out)}")
for s in out:
    print(f"  {s['page_id']:34s} {s['title'][:44]:46s} blocks={len(s['blocks'])}")
