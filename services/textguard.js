// Checks text a user is about to post PUBLICLY (feature requests and comments) before it is sent:
//   'rude'       bad words (also with look-alike characters: f*ck, sh1t, fuuuck)
//   'link'       a URL, website, e-mail address or phone number (not allowed at all, same as rude words)
//   'gibberish'  keyboard mashing / random letters ("sduhaodhwoah", "asdfghjkl", "aaaaaaa", "!!!!!!!!")
// null means fine. It is a first filter, not a judge: the database repeats the rude-word and link rules for
// custom clients, and the AI review (moderate-feature-text) catches what these rules cannot.
// Deliberately forgiving: only long, clearly impossible words count as gibberish, so ordinary,
// foreign or unusual real words are not rejected. Latin-letter words only; other scripts are skipped.
const ZeloTextGuard = (() => {
  // look-alikes -> letters, then repeated letters squeezed (fuuuck -> fuck)
  function _normalize(t) {
    return String(t || '').toLowerCase()
      .replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[7]/g, 't')
      .replace(/(\p{L})\1{2,}/gu, '$1$1');
  }
  // stems with word boundaries, so "assess", "classic", "grape", "Dickens", "therapist" are not flagged
  const SUF = '(s|es|ed|er|ers|ing|in|y|ies|head|heads|wit|wits|face|hole|holes|off)?';
  const RUDE = new RegExp('\\b(' + [
    'f+u+c+k+' + SUF, 'f+u+k+' + SUF, 'sh+i+t+' + SUF, 'b+i+t+c+h+' + SUF, 'c+u+n+t+' + SUF, 'n+i+g+[ae]+r*s?', 'n+i+g+g+(a|er|ers|as)',
    'f+a+g+(o+t+)?s?', 'r+e+t+a+r+d+' + SUF, 'wh+o+r+e+' + SUF, 's+l+u+t+' + SUF, 'd+i+c+k+' + SUF, 'p+u+s+s+(y|ies)',
    'a+s+s+h+o+l+e+s?', 'b+a+s+t+a+r+d+s?', 'k+y+s', 'kill\\s+(yo)?u?r?\\s*self', 'p+o+r+n+(o|s)?', 'n+a+z+i+s?',
    'p+i+s+s+(ed|ing|es)?', 't+w+a+t+s?', 'w+a+n+k+(er|ers|s)?', 'c+o+c+k+s?', 'r+a+p+(e|ed|es|ing|ist)', 'c+u+m+(shot)?',
  ].join('|') + ')\\b', 'u');

  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  // Consonant clusters (3+ letters) that real words use; anything else of that length is not English-like.
  // 3+ letter consonant clusters that occur in at least 3 real English words (counted over a full dictionary), plus a few plural/suffix forms.
  const OK_CLUSTERS = new Set((
    'bbl bbr bch bcl bcr bdr bfl bfr bgl bgr bkh bph bpl bpr '+
    'brh bsc bsch bscr bsh bsl bsm bsp bsph bst bstr btf bth btl '+
    'btr bts cch ccl ccr chb chbl chc chf chh chk chl chm chn '+
    'chr chs chsh chsm chst cht chth chtm chtsm chw chz ckb ckbr ckc '+
    'ckch ckcl ckcr ckd ckdr ckf ckfl ckfr ckg ckh ckj ckk ckkn ckl '+
    'ckm ckn ckp ckpr ckr cks cksc cksh cksk cksl cksm cksn cksp ckst '+
    'ckstr cksw ckt ckth ckthr cktr ckw ckwh cph cst ctf cth ctl ctm '+
    'ctn ctr cts ctw dbr dch dcl dcr ddf ddh ddl ddm ddr dfl '+
    'dfr dgl dgm dgr dkn dpl dpr dsb dsc dscr dsh dsk dsl dsm '+
    'dsp dspr dst dstr dsw dth dthr dthw dtr ffb ffc ffg ffh ffk '+
    'ffl ffm ffn ffr ffs ffsc ffsh fft ffw fsh fst ftb ftf ftg '+
    'fth ftl ftm ftn ftpr fts ftsm ftsw ftt ftw gfr ggl ggr ghb '+
    'ghbr ghc ghdr ghf ghg ghh ghl ghm ghn ghp ghr ghs ghsh ghst '+
    'ght ghtb ghtc ghtf ghth ghtl ghtm ghtn ghtr ghts ghtsh ghtsm ghtsw ghtt '+
    'ghtw ghw gnf gnl gnm gnsh gnt gpr gsh gsk gsm gst gtr hlh '+
    'hmm hnn hns hsh kch khl khm kht khw kpr ksh ksm kst lbl '+
    'lbr lch lchr lcl lcr lct ldb ldbr ldc ldcr ldf ldfl ldgr ldh '+
    'ldl ldm ldn ldr lds ldsh ldsm ldsp ldst ldt ldw lfb lfd lff '+
    'lfh lfk lfl lfm lfn lfp lfr lfs lfw lgl lgr lkf lkh lkl '+
    'lkm lks lkst lkw llb llbr llc llcr lld llf llfl llg llh llm '+
    'lln llp llpr llr lls llsh llsm llst llt llth lltr llw llwh lmg '+
    'lml lms lmsm lmw lpf lph lphth lpl lpn lpr lpt lpw lsb lsc '+
    'lsh lsk lsm lsp lst lstr lsw ltb ltc ltf lth lthf lthl lthm '+
    'lths ltl ltm ltn ltp ltpr ltr lts ltw ltz lwr mbb mbd mbf '+
    'mbh mbk mbl mbm mbn mbr mbs mbst mch mcl mcr mdr mfl mfr '+
    'mml mnl mpb mpf mph mphl mphr mpk mpl mpm mpn mppr mpr mps '+
    'mpsh mpsm mpst mpt mptl mptn mptr mpw msb msc mscr msh msk msm '+
    'msp mst mstr mth mtr nbl nbr nch nchb nchf nchl nchm nchn nchp '+
    'nchr nchw nck ncl ncr nct nctl nctn ndb ndbl ndbr ndc ndcl ndcr '+
    'ndd ndf ndfl ndg ndgr ndh ndj ndk ndl ndm ndn ndp ndpl ndpr '+
    'ndr nds ndsh ndsl ndsm ndsp ndst ndt ndw ndwh ndwr nfl nfr ngb '+
    'ngc ngcr ngd ngf ngg ngh nghts ngj ngk ngl ngly ngm ngn ngp '+
    'ngpr ngr ngs ngsh ngsm ngsp ngst ngstr ngt ngth ngthf ngthl ngths ngw '+
    'nkb nkd nkf nkg nkh nkl nkm nkn nkp nkr nks nksh nksm nkst '+
    'nkt nkw nnh nnl nns nph nphr npl npr nps nrh nsb nsc nsch '+
    'nscr nsd nsf nsfl nsgr nsh nshr nsk nskr nsl nsm nsn nsp nsph '+
    'nspl nspr nsq nsr nss nssh nst nstr nsv nsw ntb ntbr ntc ntd '+
    'ntf ntg nth nthl nthr nths nthw ntj ntl ntm ntn ntp ntpr ntr '+
    'nts ntsh ntsm ntst ntw ntz nwh nwr nzd pbl pbr pch pcl pcr '+
    'pdr pfl pfr pgl pgr phl phn phr pht phth pkn pph ppl ppr '+
    'psc psh psk psl psm psn psp pspr pst pstr psw ptc pth ptl '+
    'ptn ptr pts ptsh pwh pwr rbl rbr rbst rbw rcgr rch rchb rchc '+
    'rchch rchcr rchd rchf rchfl rchg rchh rchl rchm rchp rchpl rchpr rchr rchs '+
    'rchsh rcht rchtr rchv rchw rck rcl rcr rct rdb rdc rdcr rdd rdf '+
    'rdh rdl rdm rdn rdpl rdr rds rdsh rdsm rdst rdsw rdt rdv rdw '+
    'rfb rff rfh rfl rfm rfr rgh rgl rgn rgr rkb rkd rkf rkh '+
    'rkl rkm rkn rkp rkr rks rksh rksm rkt rkw rlb rld rldl rldw '+
    'rlh rlp rlw rmb rmf rmh rml rmn rmpr rmr rms rmth rmw rnb '+
    'rnbl rnbr rnc rncr rnd rnf rnfl rng rnh rnl rnm rnn rnp rnpl '+
    'rnpr rnr rns rnsh rnsk rnst rnt rnw rph rpl rpm rpn rpr rps '+
    'rpsh rpt rpw rrh rsc rsch rscr rsd rsh rshl rshn rshr rsk rsl '+
    'rsm rsn rsp rsph rspl rspr rsq rss rst rstf rsth rstl rstr rsw '+
    'rtb rtbr rtc rtcr rtd rtf rtg rth rthb rthbr rthc rthf rthg rthl '+
    'rthm rthn rthp rthq rthr rths rthsh rthst rtht rthw rtl rtm rtn rtr '+
    'rts rtsch rtsh rtsm rtst rtsw rtt rtv rtw rtz rwh rwr sbr sch '+
    'schl schm schn schr schw scl scr sdr sfr sgl sgr shb shc shcl '+
    'shd shf shg shh shk shl shm shn shp shpl shpr shr shsh sht '+
    'shtr shw shwh skf skh skl skm skn skr skw snt spb sph sphr '+
    'spl spn spr srh ssb ssbr ssc ssd ssf ssfl ssh ssl ssm ssn '+
    'ssp sspr ssr sssh sst sstr ssw stb stbr stc stcl stcr std stf '+
    'stfl stg stgl stgr sth sthm sthr sths stl stm stn stp stpl stpr '+
    'str sts stsc stscr stsh stsph stt stth sttr stv stw tbl tbr tch '+
    'tchb tchc tchcr tchd tchf tchh tchk tchl tchm tchn tchp tchpr tchw tcl '+
    'tcr tdr tdw tfl tfr tgl tgr thb thbr thc thd thdr thf thfl '+
    'thh thl thm thn thp thr ths thsh thsm thst tht thv thw tkn '+
    'tpl tpr tsb tsc tsch tsh tsk tsl tsm tsn tsp tspr tst tstr '+
    'tsw tth tthr ttl ttn ttr tts ttv ttw twr tzsch vsk wbr wch '+
    'wcr wdl wdn wdr wfl wgr wkn wkw wlf wll wls wnb wnbr wnc '+
    'wnf wng wnh wnl wnm wnn wnr wns wnsh wnsl wnsm wnst wnstr wnt '+
    'wnthr wntr wnw wpl wpr wsb wsc wsh wsk wsl wsm wsp wspr wsr '+
    'wst wstr wsw wth xch xcl xcr xfl xpl xpr xsc xsh xth xtl '+
    'xtr xts zzl '
  ).trim().split(/\s+/));

  // Compound words (girlfriend, armchair, breakthrough) put one word's ending next to the next word's start,
  // so a cluster is also fine when it splits into a valid word-ending + a valid word-start.
  const CODAS = new Set(('ld lf lk lm lp lt lb lc ls lv lth lms lks lps lts lds rb rc rd rf rg rk rl rm rn rp rs rt rv rth rch rsh rst rts rds rks rms rns rps rls ' +
    'ft fts pt pts ct cts ck cks ks ps ts ds gs ng ngs ngth nk nks nd nds nt nts ns nch nth mp mps mb ss ll ff zz st sts sk sks sp sps th ths sh ght ghts tch').split(' '));
  const ONSETS = new Set('bl br ch cl cr dr fl fr gl gr kn ph pl pr qu sc sch sh sk sl sm sn sp spl spr squ st str sw th thr tr tw wh wr'.split(' '));
  function _clusterOk(r) {
    if (OK_CLUSTERS.has(r)) return true;
    for (let i = 1; i < r.length; i++) {
      const a = r.slice(0, i), b = r.slice(i);
      if ((a.length === 1 || CODAS.has(a)) && (b.length === 1 || ONSETS.has(b))) return true;
    }
    return false;
  }

  function isRude(text) { return RUDE.test(_normalize(text)); }

  // Links, e-mail addresses, phone numbers. Mirrors feature_text_has_contact() in the database.
  const CONTACT = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|ly|me|xyz)\b|@[a-z0-9_.]{3,}|[0-9][0-9 ()+.-]{8,}[0-9])/i;
  function isContactInfo(text) { return CONTACT.test(String(text || '')); }

  function _tokenGibberish(tok) {
    if (tok.length < 4) return false;
    if (/(.)\1{3,}/.test(tok)) return true;                                          // aaaa, hhhhh
    // mostly a run of neighbouring keyboard keys (qwerty, asdfgh, hjkl); "property" contains "erty" but is not mostly keys
    let best = 0;
    for (const row of ROWS) for (let i = 0; i < tok.length; i++) for (let j = i + 1; j <= tok.length; j++) {
      const sub = tok.slice(i, j);
      if (sub.length > best && (row.includes(sub) || row.split('').reverse().join('').includes(sub))) best = sub.length;
    }
    if (best >= 4 && best / tok.length >= 0.6) return true;
    if (tok.length >= 5 && !/[aeiouy]/.test(tok)) return true;                       // hjklmn
    if (/q(?!u)/.test(tok) && tok.length >= 5) return true;                          // q without u (qwxz...)
    if (tok.length >= 8) {                                                           // long word with an impossible consonant cluster
      const runs = tok.match(/[^aeiouy]{3,}/g) || [];
      if (runs.some(r => !_clusterOk(r))) return true;
    }
    return false;
  }

  function isGibberish(text) {
    const t = String(text || '');
    const letters = (t.match(/\p{L}/gu) || []).length;
    if (t.trim().length >= 4 && letters < 2) return true;                            // "!!!!!!!!", "12345678"
    const words = t.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
    let flagged = 0, checked = 0;
    for (const w of words) {
      const tok = w.replace(/'/g, '');
      if (!/^[a-z]+$/.test(tok)) continue;                                           // other scripts / accents: not judged
      checked++;
      if (_tokenGibberish(tok)) flagged++;
    }
    return flagged > 0 && flagged >= Math.max(1, Math.ceil(checked * 0.25));        // one mashed word in a long sentence is allowed to slide to the AI; short text is judged strictly
  }

  // 'rude' | 'link' | 'gibberish' | null
  function check(text) {
    if (isRude(text)) return 'rude';
    if (isContactInfo(text)) return 'link';
    if (isGibberish(text)) return 'gibberish';
    return null;
  }
  const MESSAGES = {
    rude: "Please keep it respectful. That kind of language isn't allowed here.",
    link: "Links, emails and phone numbers aren't allowed in posts. Please remove it and try again.",
    gibberish: "That doesn't look like real words. Please write it out so others can understand.",
  };
  return { check, isRude, isContactInfo, isGibberish, MESSAGES };
})();
if (typeof module !== 'undefined') module.exports = ZeloTextGuard;
