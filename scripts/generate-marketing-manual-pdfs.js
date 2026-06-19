const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs');
const COMMERCIAL_PATH = path.join(OUTPUT_DIR, 'PPC-Pro-Comercial.pdf');
const MANUAL_PATH = path.join(OUTPUT_DIR, 'PPC-Pro-Manual-de-Uso.pdf');
const MANUAL_ASSETS_DIR = path.join(OUTPUT_DIR, 'manual-assets');

const COLORS = {
  navy: '#0f3552',
  teal: '#0e8b7c',
  sky: '#dfeefa',
  mint: '#dff4ee',
  gold: '#d99920',
  sand: '#fff1d9',
  red: '#b33a4a',
  blush: '#fde8eb',
  ink: '#1a3347',
  text: '#28465b',
  muted: '#6b8293',
  line: '#adc7dd',
  white: '#ffffff',
  softBg: '#f7fbfe',
};

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function fmtNow() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
  });
}

function drawRoundBox(doc, x, y, w, h, fill, stroke = COLORS.line, radius = 12) {
  doc.save();
  doc.roundedRect(x, y, w, h, radius);
  if (fill) doc.fillAndStroke(fill, stroke);
  else doc.stroke(stroke);
  doc.restore();
}

function drawBadge(doc, x, y, size = 56) {
  drawRoundBox(doc, x, y, size, size, COLORS.teal, COLORS.teal, 14);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(size * 0.34)
    .text('PPC', x, y + (size * 0.33), { width: size, align: 'center', lineBreak: false });
}

function createBaseDoc() {
  return new PDFDocument({
    margin: 42,
    size: 'A4',
    bufferPages: true,
    autoFirstPage: true,
  });
}

function pageSize(doc) {
  const margin = 42;
  return {
    margin,
    width: doc.page.width,
    height: doc.page.height,
    contentWidth: doc.page.width - (margin * 2),
    bottom: doc.page.height - margin,
  };
}

function addFooterNumbers(doc, skipFirstPage = true) {
  const range = doc.bufferedPageRange();
  const totalDisplay = skipFirstPage ? Math.max(range.count - 1, 0) : range.count;
  for (let i = 0; i < range.count; i += 1) {
    if (skipFirstPage && i === 0) continue;
    doc.switchToPage(range.start + i);
    const { margin, contentWidth, height } = pageSize(doc);
    const displayNumber = skipFirstPage ? i : (i + 1);
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5)
      .text(`${displayNumber}/${totalDisplay}`, margin, height - 22, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

function makeWriter(filePath) {
  ensureOutputDir();
  return fs.createWriteStream(filePath);
}

function textHeight(doc, text, width, options = {}) {
  return doc.heightOfString(text, {
    width,
    align: options.align || 'justify',
    lineGap: options.lineGap || 3,
  });
}

function writePdf(filePath, builder) {
  return new Promise((resolve, reject) => {
    const doc = createBaseDoc();
    const out = makeWriter(filePath);
    out.on('finish', resolve);
    out.on('error', reject);
    doc.on('error', reject);
    doc.pipe(out);
    builder(doc);
    doc.end();
  });
}

function buildCommercialPdf(doc) {
  const { margin, contentWidth, height } = pageSize(doc);

  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.softBg);
  drawRoundBox(doc, margin, 52, contentWidth, 185, COLORS.navy, COLORS.navy, 20);
  drawBadge(doc, margin + 24, 78, 78);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(30)
    .text('PPC-Pro', margin + 126, 84, { width: contentWidth - 150, align: 'left' });
  doc.fontSize(17).text('Planejamento de curto prazo com método, controle e força de gestão', margin + 126, 126, {
    width: contentWidth - 150,
    align: 'left',
    lineGap: 4,
  });
  doc.font('Helvetica').fontSize(11.5)
    .text('Uma plataforma criada para transformar a rotina semanal da obra em previsibilidade operacional, disciplina de execução e informação gerencial de verdade.', margin + 126, 174, {
      width: contentWidth - 156,
      align: 'left',
      lineGap: 4,
    });

  const cardsY = 270;
  const gap = 14;
  const cardWidth = (contentWidth - (gap * 2)) / 3;
  const cards = [
    ['MENOS IMPROVISO', 'Organiza o ciclo semanal da obra e reduz mudanças descontroladas.'],
    ['MAIS COBRANÇA', 'Registra responsáveis, causas, atrasos, reaberturas e histórico.'],
    ['MAIS GESTÃO', 'Converte rotina operacional em relatório, dashboard e material executivo.'],
  ];
  cards.forEach((card, idx) => {
    const x = margin + ((cardWidth + gap) * idx);
    drawRoundBox(doc, x, cardsY, cardWidth, 94, idx === 1 ? COLORS.mint : COLORS.sky, COLORS.line, 14);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11)
      .text(card[0], x + 12, cardsY + 14, { width: cardWidth - 24, align: 'center' });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.7)
      .text(card[1], x + 12, cardsY + 40, { width: cardWidth - 24, align: 'center', lineGap: 3 });
  });

  drawRoundBox(doc, margin, 390, contentWidth, 116, COLORS.white, COLORS.line, 16);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(15)
    .text('Por que o PPC-Pro é valioso para uma construtora?', margin + 18, 406, { width: contentWidth - 36 });
  const valueText = 'Porque ele ataca exatamente o ponto em que a maioria das obras perde produtividade: a conexão entre o que foi prometido, o que foi validado com os empreiteiros, o que foi executado e o que volta como aprendizado para a semana seguinte. O PPC-Pro não é só um sistema para lançar tarefas. Ele é uma estrutura de governança do compromisso semanal da obra.';
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10.8)
    .text(valueText, margin + 18, 436, {
      width: contentWidth - 36,
      align: 'justify',
      lineGap: 4,
    });

  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.softBg);
  drawRoundBox(doc, margin, 28, contentWidth, 56, COLORS.sky, COLORS.line, 14);
  drawBadge(doc, margin + 12, 36, 38);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(19)
    .text('DORES QUE O PPC-PRO RESOLVE', margin + 66, 45, { width: contentWidth - 78 });

  const painBlocks = [
    ['Planejamento que muda demais', 'Quando a obra não diferencia intenção, validação e programação final, a equipe perde referência e o compromisso semanal vira improviso.'],
    ['Reuniões sem método', 'Sem convocação, ata, presença e rastreabilidade, a reunião de PPC vira conversa solta e não um instrumento de produção.'],
    ['Feedback inconsistente', 'Quando o feedback da semana é mal registrado, as causas se perdem, as pendências se confundem e o histórico deixa de ensinar.'],
    ['Gestão sem visibilidade', 'Sem relatórios e indicadores confiáveis, a liderança enxerga o problema tarde demais e cobra sem contexto.'],
  ];
  let y = 110;
  painBlocks.forEach((item, idx) => {
    const fill = idx % 2 === 0 ? COLORS.white : COLORS.mint;
    drawRoundBox(doc, margin, y, contentWidth, 92, fill, COLORS.line, 14);
    doc.fillColor(COLORS.red).font('Helvetica-Bold').fontSize(12)
      .text(item[0], margin + 18, y + 16, { width: contentWidth - 36 });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10.4)
      .text(item[1], margin + 18, y + 40, {
        width: contentWidth - 36,
        align: 'justify',
        lineGap: 4,
      });
    y += 106;
  });

  drawRoundBox(doc, margin, y + 6, contentWidth, 118, COLORS.sand, '#e2c17d', 16);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(15)
    .text('O que a diretoria e a engenharia ganham', margin + 18, y + 22, { width: contentWidth - 36 });
  const gains = [
    'Rastreabilidade de ponta a ponta do processo semanal.',
    'Capacidade real de cobrança por prazo, disciplina e desempenho.',
    'Material executivo pronto para reunião, diretoria e auditoria.',
    'Histórico confiável para aprender com erro, pendência, reserva e causa.',
  ];
  gains.forEach((text, idx) => {
    doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(11)
      .text('•', margin + 18, y + 48 + (idx * 16), { width: 10, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10.3)
      .text(text, margin + 32, y + 47 + (idx * 16), { width: contentWidth - 50, align: 'left' });
  });

  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.softBg);
  drawRoundBox(doc, margin, 28, contentWidth, 56, COLORS.mint, COLORS.line, 14);
  drawBadge(doc, margin + 12, 36, 38);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(19)
    .text('POR QUE CONTRATAR AGORA', margin + 66, 45, { width: contentWidth - 78 });

  drawRoundBox(doc, margin, 110, contentWidth, 400, COLORS.white, COLORS.line, 18);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(18)
    .text('O PPC-Pro cria uma vantagem operacional concreta', margin + 24, 132, { width: contentWidth - 48, align: 'center' });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(11)
    .text(
      'Construtoras que dominam o curto prazo produzem melhor, perdem menos energia com retrabalho de gestão e constroem uma cultura mais forte de compromisso entre engenharia e empreiteiros. O PPC-Pro foi pensado exatamente para isso: transformar rotina semanal em método, método em disciplina e disciplina em resultado.',
      margin + 28,
      174,
      { width: contentWidth - 56, align: 'justify', lineGap: 5 },
    );

  const ctaY = 298;
  const ctaX = margin + 56;
  const ctaWidth = contentWidth - 112;
  const ctaInnerX = ctaX + 26;
  const ctaInnerWidth = ctaWidth - 52;
  const ctaTitle = 'Ideal para construtoras que querem profissionalizar o PPC sem perder aderência do campo.';
  const ctaBody = 'Se a sua empresa quer previsibilidade, pressão saudável sobre os responsáveis, histórico confiável e apresentação executiva dos resultados, o PPC-Pro entrega um pacote de alto valor com impacto direto na operação.';
  doc.font('Helvetica-Bold').fontSize(16);
  const ctaTitleHeight = textHeight(doc, ctaTitle, ctaInnerWidth, { align: 'center', lineGap: 4 });
  doc.font('Helvetica').fontSize(11);
  const ctaBodyHeight = textHeight(doc, ctaBody, ctaInnerWidth, { align: 'center', lineGap: 4 });
  const ctaHeight = 28 + ctaTitleHeight + 14 + ctaBodyHeight + 28;

  drawRoundBox(doc, ctaX, ctaY, ctaWidth, ctaHeight, COLORS.navy, COLORS.navy, 20);
  const ctaTitleY = ctaY + 24;
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(16)
    .text(ctaTitle, ctaInnerX, ctaTitleY, {
      width: ctaInnerWidth,
      align: 'center',
      lineGap: 4,
    });
  doc.font('Helvetica').fontSize(11)
    .text(ctaBody, ctaInnerX, ctaTitleY + ctaTitleHeight + 14, {
      width: ctaInnerWidth,
      align: 'center',
      lineGap: 4,
    });

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
    .text(`Material comercial gerado em ${fmtNow()}`, margin, height - 58, { width: contentWidth, align: 'center' });

  addFooterNumbers(doc, false);
}

function buildManualPdf(doc) {
  const { margin, contentWidth, height, bottom } = pageSize(doc);
  const tocEntries = [];
  const tocPageIndex = 1;

  function drawHeader(title, subtitle = '') {
    drawRoundBox(doc, margin, 24, contentWidth, 44, COLORS.sky, COLORS.line, 14);
    drawBadge(doc, margin + 10, 31, 30);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(17)
      .text(title, margin + 54, 37, { width: contentWidth - 64, align: 'left', lineBreak: false });
    if (subtitle) {
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.2)
        .text(subtitle, margin + 54, 54, { width: contentWidth - 68, align: 'left', lineBreak: false });
    }
    return 88;
  }

  function footerize() {
    const range = doc.bufferedPageRange();
    const totalDisplay = Math.max(range.count - 1, 0);
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      if (i === 0) continue;
      const pageNumber = i;
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5)
        .text(`${pageNumber}/${totalDisplay}`, margin, height - 22, {
          width: contentWidth,
          align: 'center',
          lineBreak: false,
        });
      doc.page.margins.bottom = originalBottomMargin;
    }
  }

  function ensureSpace(currentY, needed, title, subtitle) {
    if (currentY + needed <= bottom - 18) return currentY;
    doc.addPage();
    return drawHeader(title, subtitle);
  }

  function sectionBanner(y, text, destination = null) {
    drawRoundBox(doc, margin, y, contentWidth, 28, COLORS.navy, COLORS.navy, 9);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(12.6)
      .text(text, margin + 12, y + 8, {
        width: contentWidth - 24,
        align: 'left',
        lineBreak: false,
        destination: destination || undefined,
      });
    return y + 40;
  }

  function paragraph(y, text, opts = {}) {
    doc.fillColor(opts.color || COLORS.text).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.fontSize || 10.2);
    doc.text(text, margin, y, {
      width: contentWidth,
      align: opts.align || 'justify',
      lineGap: opts.lineGap || 3,
    });
    return doc.y + (opts.after || 10);
  }

  function bulletList(y, items, opts = {}) {
    let currentY = y;
    items.forEach((item) => {
      const itemHeight = textHeight(doc, item, contentWidth - 24, { lineGap: 3 });
      currentY = ensureSpace(currentY, itemHeight + 18, opts.headerTitle, opts.headerSubtitle);
      doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(11)
        .text('•', margin, currentY, { width: 10, lineBreak: false });
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(opts.fontSize || 10.1)
        .text(item, margin + 16, currentY - 1, {
          width: contentWidth - 16,
          align: 'justify',
          lineGap: 3,
        });
      currentY = doc.y + 7;
    });
    return currentY;
  }

  function stepCard(y, title, body, headerTitle, headerSubtitle, fill = COLORS.white) {
    const titleH = textHeight(doc, title, contentWidth - 32, { align: 'left' });
    const bodyH = textHeight(doc, body, contentWidth - 32, { align: 'justify', lineGap: 3 });
    const totalH = 18 + titleH + 10 + bodyH + 16;
    y = ensureSpace(y, totalH, headerTitle, headerSubtitle);
    drawRoundBox(doc, margin, y, contentWidth, totalH, fill, COLORS.line, 12);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11.2)
      .text(title, margin + 14, y + 12, { width: contentWidth - 28, align: 'left' });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
      .text(body, margin + 14, y + 28 + titleH, {
        width: contentWidth - 28,
        align: 'justify',
        lineGap: 3,
      });
    return doc.y + 14;
  }

  function noteBox(y, title, items, headerTitle, headerSubtitle, fill = COLORS.mint) {
    const titleH = textHeight(doc, title, contentWidth - 34, { align: 'left' });
    let contentHeight = 0;
    items.forEach((item) => {
      contentHeight += textHeight(doc, item, contentWidth - 46, { align: 'justify', lineGap: 3 }) + 8;
    });
    const totalH = 18 + titleH + 12 + contentHeight + 12;
    y = ensureSpace(y, totalH, headerTitle, headerSubtitle);
    drawRoundBox(doc, margin, y, contentWidth, totalH, fill, COLORS.line, 12);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11.4)
      .text(title, margin + 14, y + 12, { width: contentWidth - 28, align: 'left' });
    let lineY = y + 30 + titleH;
    items.forEach((item) => {
      doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(10.5)
        .text('•', margin + 14, lineY, { width: 10, lineBreak: false });
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
        .text(item, margin + 28, lineY - 1, {
          width: contentWidth - 42,
          align: 'justify',
          lineGap: 3,
        });
      lineY = doc.y + 6;
    });
    return lineY + 8;
  }

  function assetFile(name) {
    const full = path.join(MANUAL_ASSETS_DIR, name);
    return fs.existsSync(full) ? full : null;
  }

  function screenshotBlock(y, title, fileName, caption, opts = {}) {
    const file = assetFile(fileName);
    if (!file) return y;
    const image = doc.openImage(file);
    const maxW = opts.maxWidth || (contentWidth - 24);
    const maxH = opts.maxHeight || 250;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const titleH = title ? textHeight(doc, title, contentWidth - 28, { align: 'left' }) : 0;
    const captionH = caption ? textHeight(doc, caption, contentWidth - 28, { align: 'justify', lineGap: 3 }) : 0;
    const totalH = 14 + (title ? titleH + 10 : 0) + drawH + (caption ? 10 + captionH : 0) + 14;
    y = ensureSpace(y, totalH, opts.headerTitle, opts.headerSubtitle);
    drawRoundBox(doc, margin, y, contentWidth, totalH, COLORS.white, COLORS.line, 12);
    let currentY = y + 12;
    if (title) {
      doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11.2)
        .text(title, margin + 14, currentY, { width: contentWidth - 28, align: 'left' });
      currentY += titleH + 10;
    }
    const imageX = margin + ((contentWidth - drawW) / 2);
    doc.image(file, imageX, currentY, { width: drawW, height: drawH });
    currentY += drawH;
    if (caption) {
      currentY += 10;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.4)
        .text(caption, margin + 14, currentY, {
          width: contentWidth - 28,
          align: 'justify',
          lineGap: 3,
        });
      currentY = doc.y;
    }
    return currentY + 12;
  }

  function startTopSection(title, destination, displayTitle, headerTitle = 'PPC-PRO | MANUAL DE USO', headerSubtitle = 'Guia operacional detalhado do sistema') {
    doc.addPage();
    const pageNumber = doc.bufferedPageRange().count;
    tocEntries.push({ level: 1, title, destination, pageNumber: pageNumber - 1 });
    let y = drawHeader(headerTitle, headerSubtitle);
    y = sectionBanner(y, displayTitle || title, destination);
    return y;
  }

  function addSubSection(y, title, destination, headerTitle = 'PPC-PRO | MANUAL DE USO', headerSubtitle = 'Guia operacional detalhado do sistema') {
    y = ensureSpace(y, 40, headerTitle, headerSubtitle);
    const pageNumber = doc.bufferedPageRange().count;
    tocEntries.push({ level: 2, title, destination, pageNumber: pageNumber - 1 });
    return sectionBanner(y, title, destination);
  }

  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.softBg);
  drawRoundBox(doc, margin, 56, contentWidth, 190, COLORS.navy, COLORS.navy, 20);
  drawBadge(doc, margin + 26, 84, 82);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(28)
    .text('PPC-Pro', margin + 132, 92, { width: contentWidth - 154, align: 'left' });
  doc.fontSize(18).text('Manual Operacional de Uso', margin + 132, 132, { width: contentWidth - 154, align: 'left' });
  doc.font('Helvetica').fontSize(11.2)
    .text('Guia detalhado para implantação, operação semanal e leitura gerencial do sistema.', margin + 132, 174, {
      width: contentWidth - 160,
      align: 'left',
      lineGap: 4,
    });

  drawRoundBox(doc, margin, 286, contentWidth, 250, COLORS.white, COLORS.line, 18);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(15)
    .text('O que este manual entrega', margin + 18, 304, { width: contentWidth - 36 });
  const coverItems = [
    'explica como entrar no sistema, escolher a obra e navegar pelos módulos;',
    'mostra como configurar cadastros gerais e cadastros específicos da obra;',
    'ensina, passo a passo, a operar Pré-programação, Reunião de PPC, Programação, Feedback e Qualidade Percebida;',
    'detalha as regras de negócio que controlam pendências, reservas, causas, travas, fechamentos e reaberturas;',
    'aponta onde gerar PDFs, relatórios e dashboards, além de orientar a leitura dos indicadores.',
  ];
  coverItems.forEach((item, idx) => {
    doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(11)
      .text('•', margin + 18, 338 + (idx * 34), { width: 12, lineBreak: false });
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10.6)
      .text(item.charAt(0).toUpperCase() + item.slice(1), margin + 34, 337 + (idx * 34), {
        width: contentWidth - 58,
        align: 'justify',
        lineGap: 3,
      });
  });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
    .text(`Documento gerado em ${fmtNow()}`, margin, height - 58, { width: contentWidth, align: 'center' });

  doc.addPage();
  drawHeader('PPC-PRO | MANUAL DE USO', 'Sumário com navegação rápida');

  let y = startTopSection('1. INTRODUÇÃO', 'manual_1', '1. INTRODUÇÃO');
  y = paragraph(y, 'O PPC-Pro foi estruturado para apoiar a engenharia da obra no controle do planejamento de curto prazo. Ele não funciona apenas como uma planilha digital de tarefas. O valor do sistema está em conduzir uma rotina completa: preparar a semana seguinte, validar com os empreiteiros, consolidar a programação, registrar o que de fato aconteceu em campo, avaliar a qualidade percebida e transformar tudo isso em informação gerencial confiável.');
  y = paragraph(y, 'Para um usuário novo, a melhor forma de aprender é respeitar a sequência do processo. O sistema foi desenhado para que cada etapa alimente a seguinte e para que o histórico permaneça íntegro. Por isso, ao longo deste manual, além de descrever onde clicar, nós também explicamos a lógica operacional por trás de cada módulo.');
  y = noteBox(y, 'Leitura recomendada', [
    'Se esta é a primeira implantação da obra, comece pelos capítulos de acesso, navegação e cadastros.',
    'Se a base já está pronta e você quer apenas operar a semana, vá direto ao capítulo 5.',
    'Se a sua função é mais gerencial, leia com atenção os capítulos 6 e 7.',
  ], 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema');

  y = startTopSection('2. ACESSO E NAVEGAÇÃO', 'manual_2', '2. ACESSO E NAVEGAÇÃO');
  y = addSubSection(y, '2.1 Tela de Login e entrada na obra', 'manual_2_1');
  y = paragraph(y, 'Como chegar lá: ao abrir o sistema, a primeira tela exibida é a de login. Preencha e-mail e senha e clique em "Acessar".');
  y = bulletList(y, [
    'Usuários administradores escolhem primeiro se querem entrar em uma obra ou trabalhar nos cadastros gerais.',
    'Usuários comuns entram diretamente no seletor de obras às quais possuem acesso.',
    'A obra escolhida passa a determinar quais dados o sistema irá carregar nas etapas seguintes.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Tela de entrada do sistema', '01-login.png', 'A autenticação é o ponto de partida do fluxo. A partir dela, o sistema sabe quem é o usuário, quais permissões ele possui e em quais obras ele pode atuar.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 240,
  });

  y = addSubSection(y + 4, '2.2 Tela inicial da obra', 'manual_2_2');
  y = paragraph(y, 'Como chegar lá: depois de escolher a obra, o sistema abre a Tela Inicial. Essa tela resume o status das semanas e oferece links rápidos para os módulos mais importantes.');
  y = bulletList(y, [
    'O quadro "Próximas Ações Recomendadas" ajuda a equipe a entender o próximo passo esperado.',
    'O painel resumido mostra as semanas recentes e futuras, sinalizando visualmente quais etapas estão pendentes e quais já foram fechadas.',
    'Os links rápidos servem para levar o usuário à rotina certa sem depender de memória sobre o menu completo.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Tela Inicial da obra', '02-tela-inicial.png', 'Esta é a melhor porta de entrada para o uso diário. Ela evita que o usuário "caia" em uma etapa aleatória sem contexto sobre o restante da semana.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 300,
  });

  y = addSubSection(y + 4, '2.3 Menu lateral e lógica de navegação', 'manual_2_3');
  y = paragraph(y, 'O menu lateral é o mapa do sistema. Ele separa o que é cadastro geral, o que é fluxo semanal, o que é feedback, o que é análise gerencial e o que é específico da obra. Para um usuário novo, isso reduz ansiedade porque deixa claro em que bloco cada ação acontece.');
  y = noteBox(y, 'Boa prática de navegação', [
    'Use a Tela Inicial para entender a prioridade da semana.',
    'Use o menu lateral para entrar no módulo exato que deseja operar.',
    'Evite alternar entre módulos sem salvar o que foi preenchido.',
  ], 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema', COLORS.sky);

  y = startTopSection('3. CADASTROS GERAIS', 'manual_3', '3. CADASTROS GERAIS');
  y = paragraph(y, 'Os cadastros gerais são a base mestre do sistema. Em regra, tudo o que é cadastrado aqui pode ser reaproveitado em várias obras. Isso evita retrabalho, padroniza nomenclaturas e reduz inconsistências.');
  y = addSubSection(y + 4, '3.1 Usuários e Perfis de Permissionamento', 'manual_3_1');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Cadastros Gerais > Cadastro de Usuário > Usuários ou Perfis de Permissionamento.');
  y = bulletList(y, [
    'Em "Usuários", registre nome, empresa, e-mail, senha, papel base e obras vinculadas.',
    'Em "Perfis de Permissionamento", concentre as permissões por função, evitando configurar usuário por usuário manualmente.',
    'O vínculo de obras determina em quais empreendimentos a pessoa poderá entrar.',
    'O perfil define o que ela poderá ver, editar, fechar ou reabrir.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '3.2 Cadastro de Obra', 'manual_3_2');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Cadastros Gerais > Cadastro de Obra.');
  y = bulletList(y, [
    'Cadastre nome da obra, CEP, endereço, data de início e meta PPC.',
    'A data de início define a contagem das semanas da obra. A semana 1 sempre contém a data inicial, mesmo que a obra comece no meio da semana civil.',
    'A meta PPC é usada em alertas, boxes de desempenho, relatórios semanais e históricos.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Cadastro de Obra', '09-cadastro-obra.png', 'O modal de obra foi desenhado para deixar claro o que cada campo representa. A validação de CEP reduz erro manual de endereço e ajuda o sistema a trabalhar melhor com clima e identificação da obra.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 270,
  });

  y = addSubSection(y + 4, '3.3 Empreiteiros, Tipos de Mão de Obra e Construtora', 'manual_3_3');
  y = bulletList(y, [
    'Empreiteiros são cadastrados na base geral com empresa, encarregado, e-mail, telefone e tipo de mão de obra.',
    'Tipos de mão de obra servem para filtrar e padronizar análise por especialidade.',
    'O cadastro da construtora alimenta cabeçalhos de PDFs, relatórios e documentos oficiais.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = noteBox(y, 'Regra importante', [
    'Editar um empreiteiro dentro de uma obra não pode alterar o cadastro geral.',
    'Na obra, o sistema trabalha com uma cópia operacional do empreiteiro importado.',
  ], 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema');

  y = addSubSection(y + 4, '3.4 Causas de não cumprimento e grupos de atividades', 'manual_3_4');
  y = bulletList(y, [
    'Cadastre causas em dois níveis: totalizadora (nível 1) e causa específica (nível 2).',
    'Ao marcar uma causa como "específica do empreiteiro", ela passa a afetar indicadores de desempenho que procuram separar responsabilidade direta da empresa executora.',
    'Grupos de atividades funcionam como templates reutilizáveis para montagem rápida da semana.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = startTopSection('4. CADASTROS DA OBRA', 'manual_4', '4. CADASTROS DA OBRA');
  y = paragraph(y, 'Cadastros da obra são específicos de cada empreendimento. Eles organizam a realidade física, operacional e de governança daquela obra.');
  y = addSubSection(y + 4, '4.1 Zoneamento', 'manual_4_1');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Cadastros da Obra > Zoneamento.');
  y = bulletList(y, [
    'Local 1 representa a camada principal do zoneamento.',
    'Local 2 detalha subdivisões dentro do Local 1.',
    'Sempre que possível, mantenha o zoneamento alinhado à forma como a engenharia e os empreiteiros falam da obra no dia a dia.',
    'Esse cadastro é usado em programação, feedback, mapa de calor, distribuição por zona e PDFs.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Cadastro de Zoneamento', '10-zoneamento.png', 'O Local 1 organiza a estrutura principal da obra. O Local 2 entra como detalhamento. Essa hierarquia é fundamental para relatórios, distribuição de atividades e leitura de produtividade por zona.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 290,
  });

  y = addSubSection(y + 4, '4.2 Empreiteiros da obra e grupos da obra', 'manual_4_2');
  y = bulletList(y, [
    'Importe para a obra somente os empreiteiros que realmente atuarão nela.',
    'Aplique o mesmo princípio aos grupos de atividades: importe o que faz sentido e complemente com grupos específicos da obra quando necessário.',
    'No nível da obra, você pode ajustar nome do grupo e tarefas sem alterar a base geral.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '4.3 Feriados, prazos e parâmetros de qualidade percebida', 'manual_4_3');
  y = bulletList(y, [
    'Feriados aparecem destacados em planejamento, feedback e documentos, ajudando a equipe a lembrar restrições do calendário.',
    'Prazos definem até quando cada etapa deve ser fechada e alimentam contadores regressivos e indicadores de governança.',
    'O cadastro de Qualidade Percebida define faixas e referências para PPC, colaboração, qualidade, segurança e limpeza.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = startTopSection('5. FLUXO SEMANAL OPERACIONAL', 'manual_5', '5. FLUXO SEMANAL OPERACIONAL');
  y = paragraph(y, 'Este é o coração do PPC-Pro. O sistema foi desenhado para que a semana atravesse etapas com propósito claro. Quando o fluxo é respeitado, o histórico fica consistente e os relatórios ganham valor. Quando a equipe pula etapas, começa a perder contexto e confiabilidade.');

  y = addSubSection(y + 4, '5.1 Pré-programação da Semana', 'manual_5_1');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Programação Semanal > Pré-programação da Semana.');
  y = bulletList(y, [
    'A Pré-programação é a primeira versão da semana futura. Ela organiza o que se pretende discutir com os empreiteiros antes da validação final.',
    'Nessa etapa, o sistema já pode carregar pendências e reservas herdadas automaticamente de semanas anteriores.',
    'Atividades planejadas que não foram concluídas reaparecem como Pendentes. Atividades Reserva não concluídas reaparecem como Reserva.',
    'Pendentes devem preservar texto e locais travados. Reservas podem continuar como Reserva ou virar Planejada na nova semana.',
    'O Local 1 é obrigatório para fechar a etapa.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Pré-programação da Semana', '03-pre-programacao.png', 'Observe o countdown da etapa, os cards de pendências e reservas, a previsão do tempo e a leitura rápida da planilha. A intenção aqui é montar um pacote inicial coerente para discussão com os empreiteiros.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 285,
  });
  y = noteBox(y, 'Regras importantes da Pré-programação', [
    'A etapa pode ser salva durante o preenchimento, sem necessidade de fechamento imediato.',
    'Se houver duplicidade de atividade para o mesmo empreiteiro, mesma descrição e mesmo Local 1, o sistema deve alertar o usuário.',
    'O fechamento da Pré-programação é pré-requisito para o fechamento da Reunião de PPC.',
  ], 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema', COLORS.sand);

  y = addSubSection(y + 4, '5.2 Reunião de PPC', 'manual_5_2');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Programação Semanal > Reunião de PPC.');
  y = bulletList(y, [
    'Registre data e hora da reunião.',
    'Use a etapa para gerar PDFs de convocação e atividades por empreiteiro.',
    'Depois da reunião, registre presença e preencha a ata.',
    'Somente empreiteiros ativos na semana devem compor lista de presença, convocação e ata.',
    'A reunião só pode ser fechada depois da Pré-programação fechada.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Reunião de PPC', '04-reuniao-ppc.png', 'A etapa da reunião funciona como ponte entre intenção e compromisso validado. É aqui que a obra formaliza quem participou, o que foi discutido e quais materiais serão distribuídos.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 285,
  });

  y = addSubSection(y + 4, '5.3 Programação da Semana', 'manual_5_3');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Programação Semanal > Programação da Semana.');
  y = bulletList(y, [
    'A Programação herda as atividades da Pré-programação e representa o compromisso final da semana.',
    'Depois da reunião, ajuste status, ordem, datas e distribuição final.',
    'Atividades pendentes vindas de semana anterior entram com status Pendente e não devem ter texto nem locais editáveis.',
    'Atividades Reserva herdadas continuam com status Reserva e podem ser alteradas para Planejada, caso a engenharia decida efetivar a execução.',
    'A Programação só pode ser fechada depois da Reunião de PPC fechada.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Programação da Semana', '05-programacao.png', 'Esta é a referência oficial da semana. Tudo o que aparece em Atividades Previstas, PDFs operacionais e base de comparação do feedback nasce do fechamento desta etapa.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 285,
  });

  y = addSubSection(y + 4, '5.4 Atividades Previstas', 'manual_5_4');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Programação Semanal > Atividades Previstas.');
  y = bulletList(y, [
    'Mostra somente as atividades validadas pela Programação fechada.',
    'É a base operacional mais limpa para distribuição por empreiteiro, exportações e PDFs definitivos.',
    'Quando a Programação ainda não está fechada, esta etapa não deve ser tratada como versão oficial da semana.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '5.5 Feedback da Semana', 'manual_5_5');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Feedback > Feedback da Semana.');
  y = bulletList(y, [
    'O Feedback registra o que realmente aconteceu: executada, iniciada, não iniciada, cancelada ou executada não planejada.',
    'O salvamento pode ser parcial. O fechamento, não: ele exige consistência completa.',
    'Atividades iniciadas e não iniciadas exigem grupo da causa, causa e comentário, salvo quando forem Reserva não concluída.',
    'Canceladas não exigem causa obrigatória, mas podem receber comentário.',
    'Ao fechar o feedback, o sistema alimenta pendências, histórico de causas e comparações com semanas futuras.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Feedback da Semana', '06-feedback.png', 'Repare nos cards-resumo, no countdown, na legenda das regras e na tabela com filtros. O feedback é a etapa que mais exige disciplina, porque é dela que saem pendências, aprendizado e indicadores de desempenho.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 285,
  });
  y = noteBox(y, 'Regras críticas do Feedback', [
    'Executada, Executada / Não planejada e Cancelada não abrem causa obrigatória.',
    'Iniciada e Não iniciada exigem grupo da causa, causa e comentário.',
    'Reserva não concluída fica sem causa obrigatória e deve ser identificada visualmente para não induzir preenchimento incorreto.',
    'Somente depois do fechamento do Feedback a semana pode avançar para Qualidade Percebida.',
  ], 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema', COLORS.blush);

  y = addSubSection(y + 4, '5.6 Qualidade Percebida', 'manual_5_6');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Feedback > Qualidade Percebida.');
  y = bulletList(y, [
    'A Qualidade Percebida avalia cada empreiteiro ativo da semana em PPC, colaboração, qualidade, segurança e limpeza.',
    'A etapa só é liberada depois do fechamento do Feedback.',
    'Ela só pode ser fechada quando todos os empreiteiros da semana estiverem avaliados.',
    'Depois de fechada, o sistema precisa indicar a situação fechada, esconder o botão de fechamento e liberar a reabertura apenas para administrador.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Qualidade Percebida', '07-qualidade-percebida.png', 'A avaliação usa notas e carinhas para traduzir rapidamente a percepção sobre cada empreiteiro. Essa camada complementa o PPC, porque olha não só prazo, mas também colaboração, limpeza, qualidade e segurança.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 270,
  });

  y = startTopSection('6. RELATÓRIOS, PDFS E DASHBOARDS', 'manual_6', '6. RELATÓRIOS, PDFS E DASHBOARDS');
  y = addSubSection(y, '6.1 PDFs operacionais', 'manual_6_1');
  y = bulletList(y, [
    'O sistema gera PDFs de atividades por empreiteiro, listas gerais, atas, convocações, comparativos, calendários de feriados e documentos de apoio.',
    'Cada documento tem finalidade própria: comunicação com empreiteiro, reunião de PPC, auditoria de fechamento ou leitura gerencial.',
    'O padrão visual e o cabeçalho institucional reforçam rastreabilidade e profissionalismo.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '6.2 Relatório da Semana', 'manual_6_2');
  y = paragraph(y, 'Como chegar lá: Menu Lateral > Gestão e Dashboards > Relatório da Semana.');
  y = bulletList(y, [
    'O relatório semanal é o dossiê da semana fechada.',
    'Ele combina desempenho PPC, causas, ranking de empreiteiros, qualidade percebida e governança.',
    'É o documento ideal para reunião de engenharia, cobrança da diretoria e registro formal do que ocorreu na semana.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });
  y = screenshotBlock(y, 'Tela do Relatório da Semana', '08-relatorio-semanal.png', 'A interface apresenta filtros e indicadores antes da geração do PDF. O PDF final aprofunda a leitura com capítulos, seções e material pronto para apresentação.', {
    headerTitle: 'PPC-PRO | MANUAL DE USO',
    headerSubtitle: 'Guia operacional detalhado do sistema',
    maxHeight: 270,
  });

  y = addSubSection(y + 4, '6.3 Histórico da obra', 'manual_6_3');
  y = bulletList(y, [
    'O histórico mostra a trajetória acumulada da obra ao longo do tempo.',
    'É nele que a gestão enxerga tendência de desempenho, evolução mensal, recorrência de causas, desempenho por empreiteiro e qualidade do planejamento.',
    'O valor do histórico depende da disciplina semanal. Se o fluxo operacional for mal preenchido, a leitura histórica perde confiabilidade.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = startTopSection('7. REGRAS DE NEGÓCIO FUNDAMENTAIS', 'manual_7', '7. REGRAS DE NEGÓCIO FUNDAMENTAIS');
  y = addSubSection(y, '7.1 Ordem das etapas e travas', 'manual_7_1');
  y = bulletList(y, [
    'A ordem lógica do processo é: Pré-programação, Reunião de PPC, Programação, Atividades Previstas, Feedback e Qualidade Percebida.',
    'A Reunião não deve ser fechada sem Pré-programação fechada.',
    'A Programação não deve ser fechada sem Reunião fechada.',
    'O Feedback não deve ser tratado como encerrado antes da Programação fechada.',
    'A Qualidade Percebida não deve ser fechada antes do Feedback e antes da avaliação de todos os empreiteiros ativos.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '7.2 Pendências, reservas, retrabalho e semana de origem', 'manual_7_2');
  y = bulletList(y, [
    'Atividade planejada não concluída volta na semana seguinte como Pendente, com semana de origem preservada.',
    'Atividade Reserva não concluída volta como Reserva, e seu status pode ser ajustado na nova semana.',
    'Atividade de retrabalho deve ser identificada para que o histórico e os indicadores reflitam essa condição.',
    'A coluna de semana de origem preserva a memória de onde cada atividade nasceu, mesmo quando ela se arrasta por mais de uma semana.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '7.3 Causas, cancelamentos e desempenho', 'manual_7_3');
  y = bulletList(y, [
    'Causas bem preenchidas explicam por que o plano não foi cumprido.',
    'Causas marcadas como específicas do empreiteiro afetam indicadores que medem performance da empresa executora.',
    'Cancelamentos alteram a leitura da qualidade do planejamento e do desempenho da semana.',
    'Atividades executadas e não planejadas afetam a qualidade da programação, mas não contam como atividade planejada executada no PPC clássico.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '7.4 Fechamento, reabertura e auditoria', 'manual_7_4');
  y = bulletList(y, [
    'Fechar uma etapa deve registrar data, hora e responsável.',
    'Reaberturas são exceções gerenciais e precisam ficar rastreadas.',
    'Salvar não é o mesmo que fechar: salvar preserva rascunho; fechar consolida a etapa para as análises seguintes.',
    'Essa diferença é essencial para evitar perda de trabalho e para manter o histórico auditável.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = startTopSection('8. CHECKLIST DE IMPLANTAÇÃO E OPERAÇÃO', 'manual_8', '8. CHECKLIST DE IMPLANTAÇÃO E OPERAÇÃO');
  y = addSubSection(y, '8.1 Antes de começar a usar em uma obra nova', 'manual_8_1');
  y = bulletList(y, [
    'Cadastre a construtora.',
    'Cadastre a obra com data de início correta e meta PPC definida.',
    'Cadastre ou revise empreiteiros, tipos de mão de obra, grupos de atividades e causas de não cumprimento.',
    'Monte zoneamento, feriados, prazos e parâmetros de qualidade percebida.',
    'Vincule usuários e perfis antes de colocar a equipe para operar.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '8.2 Rotina semanal recomendada', 'manual_8_2');
  y = bulletList(y, [
    'Início do ciclo: montar a Pré-programação da semana futura.',
    'Depois: convocar empreiteiros, realizar a Reunião de PPC e fechar presença/ata.',
    'Na sequência: consolidar e fechar a Programação da Semana.',
    'Durante ou após a execução: preencher e salvar o Feedback, mesmo em mais de um momento, até concluir todas as informações.',
    'Por fim: avaliar todos os empreiteiros ativos na Qualidade Percebida e gerar os relatórios da semana.',
  ], { headerTitle: 'PPC-PRO | MANUAL DE USO', headerSubtitle: 'Guia operacional detalhado do sistema' });

  y = addSubSection(y + 4, '8.3 Erros mais comuns e como evitar', 'manual_8_3');
  y = stepCard(y, 'Pular etapas', 'Isso gera erro, confusão de contexto e perda de força do histórico. Sempre avance na ordem natural do processo.', 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema', COLORS.blush);
  y = stepCard(y, 'Fechar cedo demais', 'Fechar uma etapa sem revisar pendências, reservas, causas e datas produz relatórios menos confiáveis e aumenta a necessidade de reabertura.', 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema', COLORS.sand);
  y = stepCard(y, 'Usar o sistema só como planilha', 'O diferencial do PPC-Pro está em transformar preenchimento em método, histórico e análise. Quem usa só a planilha perde o principal valor do produto.', 'PPC-PRO | MANUAL DE USO', 'Guia operacional detalhado do sistema', COLORS.blush);

  doc.switchToPage(tocPageIndex);
  let tocY = 96;
  drawRoundBox(doc, margin, tocY, contentWidth, 30, COLORS.navy, COLORS.navy, 10);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(13)
    .text('SUMÁRIO', margin + 12, tocY + 9, { width: contentWidth - 24, align: 'left', lineBreak: false });
  tocY += 46;
  tocEntries.forEach((entry) => {
    const label = entry.level === 1 ? entry.title : `   ${entry.title}`;
    doc.fillColor(entry.level === 1 ? COLORS.navy : COLORS.text).font(entry.level === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(entry.level === 1 ? 10.8 : 10.1)
      .text(label, margin, tocY, {
        width: contentWidth - 44,
        align: 'left',
        goTo: entry.destination,
        underline: false,
        lineGap: 2,
      });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.6)
      .text(String(entry.pageNumber), margin + contentWidth - 32, tocY, {
        width: 32,
        align: 'right',
        lineBreak: false,
      });
    tocY += entry.level === 1 ? 17 : 15;
  });

  footerize();
}

async function main() {
  await writePdf(COMMERCIAL_PATH, buildCommercialPdf);
  await writePdf(MANUAL_PATH, buildManualPdf);
  console.log(`PDF comercial gerado em: ${COMMERCIAL_PATH}`);
  console.log(`PDF manual gerado em: ${MANUAL_PATH}`);
}

main().catch((error) => {
  console.error('Falha ao gerar PDFs:', error);
  process.exitCode = 1;
});
