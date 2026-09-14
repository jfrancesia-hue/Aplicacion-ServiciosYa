<?php

if (!isset($legalDocumentKind) || !in_array($legalDocumentKind, ['terms', 'privacy'], true)) {
    http_response_code(500);
    exit('Documento legal no configurado.');
}

$legalRootDirectory = dirname(__DIR__);
$legalPayloadPath = $legalRootDirectory . '/legal-documents.json';
$legalPayload = json_decode((string) file_get_contents($legalPayloadPath), true);

if (!is_array($legalPayload) || !isset($legalPayload['documents'][$legalDocumentKind])) {
    http_response_code(500);
    exit('Documento legal temporalmente no disponible.');
}

$legalDocument = $legalPayload['documents'][$legalDocumentKind];
$legalOperator = $legalPayload['operator'];
$legalPublicUrls = $legalPayload['publicUrls'];
$legalOtherKind = $legalDocumentKind === 'terms' ? 'privacy' : 'terms';
$legalOtherLabel = $legalOtherKind === 'terms'
    ? 'Términos y Condiciones'
    : 'Política de Privacidad';

function serviciosya_legal_escape($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$legalHeaderMarkup = '';
$legalHeaderPath = $legalRootDirectory . '/header.php';
if (is_file($legalHeaderPath)) {
    ob_start();
    include $legalHeaderPath;
    $legalHeaderMarkup = (string) ob_get_clean();
}

$legalFooterMarkup = '';
$legalFooterPath = $legalRootDirectory . '/footer.php';
if (is_file($legalFooterPath)) {
    ob_start();
    include $legalFooterPath;
    $legalFooterMarkup = (string) ob_get_clean();
}

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');
?>
<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= serviciosya_legal_escape($legalDocument['title']) ?></title>
  <meta name="description" content="<?= serviciosya_legal_escape($legalDocument['summary']) ?>">
  <link rel="canonical" href="<?= serviciosya_legal_escape($legalPublicUrls[$legalDocumentKind]) ?>">
  <link rel="icon" type="image/svg+xml" href="/assets/servicioya-icon.svg">
  <style>
    :root {
      color-scheme: light;
      --legal-ink: #173d45;
      --legal-muted: #4d676d;
      --legal-brand: #047a8f;
      --legal-brand-dark: #075c6b;
      --legal-border: #c6e6ea;
      --legal-surface: #ffffff;
      --legal-tint: #eaf8fa;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #f4fafb;
      color: var(--legal-ink);
      font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .legal-shell {
      width: min(920px, calc(100% - 32px));
      margin: 40px auto 64px;
    }

    .legal-card {
      overflow: hidden;
      background: var(--legal-surface);
      border: 1px solid var(--legal-border);
      border-radius: 24px;
      box-shadow: 0 18px 55px rgba(15, 78, 90, 0.11);
    }

    .legal-hero {
      padding: clamp(28px, 6vw, 52px);
      color: #fff;
      background: linear-gradient(135deg, #0db7c8, #047a8f 58%, #075c6b);
    }

    .legal-eyebrow {
      display: inline-flex;
      padding: 7px 11px;
      border: 1px solid rgba(255, 255, 255, 0.38);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.13);
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .legal-hero h1 {
      max-width: 760px;
      margin: 18px 0 10px;
      font-size: clamp(2rem, 6vw, 3.4rem);
      line-height: 1.05;
    }

    .legal-hero p {
      max-width: 760px;
      margin: 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.05rem;
      line-height: 1.65;
    }

    .legal-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      margin-top: 20px;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .legal-content { padding: clamp(24px, 6vw, 52px); }

    .legal-operator {
      margin-bottom: 38px;
      padding: 20px;
      border: 1px solid var(--legal-border);
      border-radius: 16px;
      background: var(--legal-tint);
    }

    .legal-operator h2 { margin-top: 0; font-size: 1.1rem; }
    .legal-operator p { margin: 6px 0; }

    .legal-section { scroll-margin-top: 24px; }

    .legal-section + .legal-section {
      margin-top: 34px;
      padding-top: 34px;
      border-top: 1px solid #e2eff1;
    }

    .legal-section h2 {
      margin: 0 0 14px;
      color: var(--legal-brand-dark);
      font-size: clamp(1.25rem, 3vw, 1.55rem);
      line-height: 1.3;
    }

    .legal-section p,
    .legal-section li,
    .legal-operator p {
      color: var(--legal-muted);
      font-size: 1rem;
      line-height: 1.75;
    }

    .legal-section p { margin: 0 0 14px; }
    .legal-section ul { margin: 8px 0 0; padding-left: 24px; }
    .legal-section li + li { margin-top: 10px; }

    .legal-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 42px;
      padding-top: 26px;
      border-top: 1px solid #e2eff1;
    }

    .legal-link {
      display: inline-flex;
      min-height: 46px;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border: 1px solid #91ccd4;
      border-radius: 12px;
      color: var(--legal-brand);
      font-weight: 800;
      text-decoration: none;
    }

    .legal-link:hover,
    .legal-link:focus-visible { background: var(--legal-tint); }

    .legal-fallback-footer {
      padding: 24px 16px;
      color: var(--legal-muted);
      text-align: center;
    }

    @media (max-width: 600px) {
      .legal-shell { width: min(100% - 20px, 920px); margin-top: 18px; }
      .legal-card { border-radius: 18px; }
    }
  </style>
</head>
<body>
  <?= $legalHeaderMarkup ?>
  <main class="legal-shell">
    <article class="legal-card">
      <header class="legal-hero">
        <span class="legal-eyebrow">Documento vigente</span>
        <h1><?= serviciosya_legal_escape($legalDocument['title']) ?></h1>
        <p><?= serviciosya_legal_escape($legalDocument['summary']) ?></p>
        <div class="legal-meta">
          <span>Versión: <?= serviciosya_legal_escape($legalDocument['version']) ?></span>
          <span>Vigente desde: <?= serviciosya_legal_escape($legalDocument['effectiveDate']) ?></span>
          <span>Conjunto: <?= serviciosya_legal_escape($legalPayload['documentSet']) ?></span>
        </div>
      </header>

      <div class="legal-content">
        <aside class="legal-operator" aria-labelledby="legal-operator-title">
          <h2 id="legal-operator-title">Operador y responsable</h2>
          <p><strong><?= serviciosya_legal_escape($legalOperator['legalName']) ?></strong> · <?= serviciosya_legal_escape($legalOperator['taxId']) ?></p>
          <p><?= serviciosya_legal_escape($legalOperator['address']) ?></p>
          <p>Contacto: <a href="mailto:<?= serviciosya_legal_escape($legalOperator['businessEmail']) ?>"><?= serviciosya_legal_escape($legalOperator['businessEmail']) ?></a> · <a href="mailto:<?= serviciosya_legal_escape($legalOperator['supportEmail']) ?>"><?= serviciosya_legal_escape($legalOperator['supportEmail']) ?></a></p>
        </aside>

        <?php foreach ($legalDocument['sections'] as $legalSection): ?>
          <section class="legal-section">
            <h2><?= serviciosya_legal_escape($legalSection['title']) ?></h2>
            <?php foreach ($legalSection['paragraphs'] as $legalParagraph): ?>
              <p><?= serviciosya_legal_escape($legalParagraph) ?></p>
            <?php endforeach; ?>
            <?php if (!empty($legalSection['bullets'])): ?>
              <ul>
                <?php foreach ($legalSection['bullets'] as $legalBullet): ?>
                  <li><?= serviciosya_legal_escape($legalBullet) ?></li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </section>
        <?php endforeach; ?>

        <nav class="legal-actions" aria-label="Documentos legales relacionados">
          <a class="legal-link" href="<?= serviciosya_legal_escape($legalPublicUrls[$legalOtherKind]) ?>"><?= serviciosya_legal_escape($legalOtherLabel) ?></a>
          <a class="legal-link" href="/">Volver al inicio</a>
        </nav>
      </div>
    </article>
  </main>
  <?php if ($legalFooterMarkup !== ''): ?>
    <?= $legalFooterMarkup ?>
  <?php else: ?>
    <footer class="legal-fallback-footer">Servicios Ya · <?= serviciosya_legal_escape($legalOperator['legalName']) ?></footer>
  <?php endif; ?>
</body>
</html>
