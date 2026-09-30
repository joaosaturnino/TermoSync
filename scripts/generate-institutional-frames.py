"""Gera os quadros e as legendas do video institucional do ThermoSync.

Os quadros reproduzem os modulos reais com dados ficticios. Isso permite mostrar
o funcionamento do produto sem capturar nomes, leituras ou ocorrencias de clientes.
Execute pelo script PowerShell ``generate-institutional-video.ps1``, que tambem
gera a narracao e monta o MP4 final.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
BUILD = ROOT / ".artifacts" / "institutional-video"
WIDTH, HEIGHT = 1280, 720

COLORS = {
    "ink": "#061117",
    "sidebar": "#081a22",
    "panel": "#0d242d",
    "panel_alt": "#102d37",
    "line": "#24414a",
    "text": "#f4f8fa",
    "muted": "#91a8b1",
    "cyan": "#31d7c7",
    "blue": "#43a7ff",
    "green": "#36c98f",
    "yellow": "#f2c94c",
    "orange": "#f2994a",
    "red": "#ef5a5a",
}


def font(size, bold=False):
    """Carrega a familia Segoe UI usada pelo sistema e preserva um fallback."""
    filename = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / filename
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def rounded(draw, box, fill, outline=None, radius=10, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, size, color=None, bold=False, anchor=None):
    draw.text(xy, value, fill=color or COLORS["text"], font=font(size, bold), anchor=anchor)


def wrap(draw, value, max_width, size, bold=False):
    """Quebra texto por largura visual para evitar cortes nos quadros do video."""
    words, lines, current = value.split(), [], ""
    selected_font = font(size, bold)
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=selected_font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def base_frame(section, title, subtitle):
    """Monta o cenario comum: fundo, cabecalho institucional e selo de demo."""
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["ink"])
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 72), fill="#071820")
    draw.rectangle((0, 70, WIDTH, 72), fill=COLORS["cyan"])
    text(draw, (44, 25), "THERMOSYNC", 25, bold=True)
    text(draw, (230, 31), "REDE TERMICA SINCRONIZADA", 12, COLORS["muted"], bold=True)
    rounded(draw, (1032, 20, 1236, 51), "#12343b", COLORS["line"], 6)
    text(draw, (1134, 36), "AMBIENTE DE DEMONSTRAÇÃO", 10, COLORS["cyan"], True, "mm")
    text(draw, (44, 98), section.upper(), 13, COLORS["cyan"], True)
    text(draw, (44, 125), title, 34, bold=True)
    text(draw, (44, 169), subtitle, 17, COLORS["muted"])
    return image, draw


def save(image, index):
    path = BUILD / f"frame-{index:02d}.png"
    image.save(path, quality=95)
    return path


def intro_frame():
    """Apresenta o produto usando a fotografia institucional da landing page."""
    source = Image.open(PUBLIC / "landing-refrigerated-displays-v4.png").convert("RGB")
    source = source.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=(3, 13, 18, 150))
    draw.rectangle((0, 0, 760, HEIGHT), fill=(3, 13, 18, 205))
    source = Image.alpha_composite(source.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(source)
    rounded(draw, (56, 54, 266, 88), "#12343b", COLORS["cyan"], 6)
    text(draw, (161, 71), "MONITORAMENTO IOT", 12, COLORS["cyan"], True, "mm")
    text(draw, (56, 144), "ThermoSync", 58, bold=True)
    for line_index, line in enumerate(wrap(draw, "Da leitura do sensor a uma resposta operacional rastreável.", 650, 30, True)):
        text(draw, (56, 232 + line_index * 39), line, 30, bold=True)
    text(draw, (56, 355), "Conheça o fluxo completo da plataforma em pouco mais de um minuto.", 18, "#d5e3e8")
    stages = [("01", "Coleta"), ("02", "Monitoramento"), ("03", "Resposta"), ("04", "Evidencia")]
    for index, (number, label) in enumerate(stages):
        x = 56 + index * 164
        rounded(draw, (x, 510, x + 145, 580), "#0c252d", COLORS["line"], 7)
        text(draw, (x + 14, 524), number, 11, COLORS["cyan"], True)
        text(draw, (x + 14, 548), label, 14, bold=True)
    text(draw, (56, 663), "Os dados exibidos neste vídeo são demonstrativos.", 11, "#b2c3ca")
    return source


def architecture_frame():
    """Explica visualmente o transporte da telemetria ate a equipe operacional."""
    image, draw = base_frame("Como funciona", "Uma linha contínua entre campo e central", "Sensores, plataforma e equipes trabalham no mesmo fluxo operacional.")
    stages = [
        ("1", "Sensores e controladores", "Temperatura, umidade, energia e estado", COLORS["blue"]),
        ("2", "Ingestão segura", "Identificação do equipamento e armazenamento", COLORS["cyan"]),
        ("3", "Regras e alertas", "Faixas, prioridade e contexto operacional", COLORS["yellow"]),
        ("4", "Equipe e evidência", "Chamados, histórico, relatórios e auditoria", COLORS["green"]),
    ]
    for index, (number, title, description, color) in enumerate(stages):
        x = 44 + index * 305
        rounded(draw, (x, 245, x + 270, 545), COLORS["panel"], COLORS["line"], 10)
        rounded(draw, (x + 22, 269, x + 66, 313), color, None, 8)
        text(draw, (x + 44, 291), number, 19, COLORS["ink"], True, "mm")
        text(draw, (x + 22, 346), title, 20, bold=True)
        for line_index, line in enumerate(wrap(draw, description, 222, 15)):
            text(draw, (x + 22, 387 + line_index * 23), line, 15, COLORS["muted"])
        if index < 3:
            text(draw, (x + 285, 388), ">", 30, COLORS["cyan"], True, "mm")
    rounded(draw, (44, 588, 1236, 648), "#0b2028", COLORS["line"], 8)
    text(draw, (64, 618), "RESULTADO", 11, COLORS["cyan"], True, "lm")
    text(draw, (180, 618), "Prioridades visíveis, resposta mais rápida e histórico preservado.", 17, bold=True, anchor="lm")
    return image


def app_shell(draw, active):
    """Desenha a estrutura compartilhada das telas autenticadas do sistema."""
    draw.rectangle((0, 0, 222, HEIGHT), fill=COLORS["sidebar"])
    text(draw, (26, 28), "ThermoSync", 24, bold=True)
    text(draw, (26, 58), "OPERACAO CONECTADA", 9, COLORS["muted"], True)
    items = ["Visão operacional", "Monitoramento", "Fila operacional", "Chamados", "Relatórios"]
    for index, item in enumerate(items):
        y = 115 + index * 56
        if item == active:
            rounded(draw, (14, y - 10, 208, y + 34), "#123840", None, 6)
            draw.rectangle((14, y - 10, 18, y + 34), fill=COLORS["cyan"])
        text(draw, (36, y + 10), item, 14, COLORS["text"] if item == active else COLORS["muted"], item == active, anchor="lm")
    draw.rectangle((222, 0, WIDTH, 72), fill="#0b1f27")
    text(draw, (252, 36), active, 20, bold=True, anchor="lm")
    rounded(draw, (1048, 20, 1248, 52), "#15313a", COLORS["line"], 16)
    text(draw, (1148, 36), "Empresa demonstração", 11, COLORS["text"], True, "mm")


def dashboard_frame():
    """Mostra o dashboard operacional com indicadores e fila priorizada."""
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["ink"])
    draw = ImageDraw.Draw(image)
    app_shell(draw, "Visão operacional")
    text(draw, (252, 98), "Resumo da operação", 26, bold=True)
    text(draw, (252, 130), "Leituras atualizadas e equipamentos ordenados por prioridade.", 14, COLORS["muted"])
    cards = [
        ("ATIVOS MONITORADOS", "24", "21 operando normalmente", COLORS["blue"]),
        ("OPERAÇÃO NORMAL", "21", "87,5% da frota", COLORS["green"]),
        ("REQUER ATENÇÃO", "2", "ação recomendada", COLORS["yellow"]),
        ("SEM TELEMETRIA", "1", "verificar conectividade", COLORS["red"]),
    ]
    for index, (label, value, detail, color) in enumerate(cards):
        x = 252 + index * 244
        rounded(draw, (x, 164, x + 222, 274), COLORS["panel"], COLORS["line"], 8)
        text(draw, (x + 16, 184), label, 10, COLORS["muted"], True)
        text(draw, (x + 16, 209), value, 31, color, True)
        text(draw, (x + 16, 252), detail, 11, COLORS["muted"])
    rounded(draw, (252, 298, 1236, 680), COLORS["panel"], COLORS["line"], 8)
    text(draw, (276, 324), "Fila operacional da frota", 18, bold=True)
    text(draw, (276, 350), "Equipamentos priorizados por risco e desvio térmico", 12, COLORS["muted"])
    columns = [(276, "EQUIPAMENTO"), (624, "TEMPERATURA"), (792, "FAIXA"), (942, "MOTOR"), (1062, "ESTADO")]
    draw.rectangle((270, 382, 1218, 420), fill=COLORS["panel_alt"])
    for x, label in columns:
        text(draw, (x, 402), label, 10, COLORS["muted"], True, anchor="lm")
    rows = [
        ("Câmara de congelados", "Depósito", "-18,2 °C", "-22 a -16 °C", "Ligado", "Operação normal", COLORS["green"]),
        ("Ilha refrigerada 03", "Area de vendas", "8,9 C", "2 a 7 C", "Ligado", "Fora da faixa", COLORS["yellow"]),
        ("Balcão de frios", "Padaria", "5,1 °C", "2 a 6 °C", "Ligado", "Operação normal", COLORS["green"]),
        ("Câmara de resfriados", "Recebimento", "--", "1 a 5 °C", "Desligado", "Sem telemetria", COLORS["red"]),
    ]
    for index, row in enumerate(rows):
        y = 443 + index * 55
        draw.line((270, y + 40, 1218, y + 40), fill=COLORS["line"], width=1)
        text(draw, (276, y), row[0], 13, bold=True)
        text(draw, (276, y + 20), row[1], 10, COLORS["muted"])
        text(draw, (624, y + 12), row[2], 14, bold=True, anchor="lm")
        text(draw, (792, y + 12), row[3], 12, COLORS["muted"], anchor="lm")
        text(draw, (942, y + 12), row[4], 12, anchor="lm")
        rounded(draw, (1054, y - 2, 1208, y + 30), "#102a31", row[6], 16)
        text(draw, (1131, y + 14), row[5], 10, row[6], True, "mm")
    return image


def monitoring_frame():
    """Mostra a consulta de equipamentos e a leitura temporal de temperatura."""
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["ink"])
    draw = ImageDraw.Draw(image)
    app_shell(draw, "Monitoramento")
    text(draw, (252, 98), "Monitoramento térmico", 26, bold=True)
    text(draw, (252, 130), "Cada ativo combina leitura atual, faixa esperada e tendencia recente.", 14, COLORS["muted"])
    equipment = [
        ("Câmara de congelados", "-18,2 °C", COLORS["green"], [-20, -19, -19, -18, -19, -18, -18]),
        ("Ilha refrigerada 03", "8,9 °C", COLORS["yellow"], [5, 5, 6, 6, 7, 8, 9]),
        ("Balcão de frios", "5,1 °C", COLORS["green"], [4, 5, 5, 4, 5, 5, 5]),
    ]
    for index, (name, value, color, points) in enumerate(equipment):
        x = 252 + index * 326
        rounded(draw, (x, 170, x + 302, 365), COLORS["panel"], color, 8)
        text(draw, (x + 18, 194), name, 16, bold=True)
        text(draw, (x + 18, 232), value, 30, color, True)
        text(draw, (x + 18, 272), "LEITURA ATUAL", 9, COLORS["muted"], True)
        chart_left, chart_top, chart_width, chart_height = x + 18, 304, 266, 38
        draw.line((chart_left, chart_top + chart_height, chart_left + chart_width, chart_top + chart_height), fill=COLORS["line"], width=1)
        low, high = min(points), max(points)
        span = max(1, high - low)
        coordinates = []
        for point_index, point in enumerate(points):
            px = chart_left + point_index * chart_width / (len(points) - 1)
            py = chart_top + chart_height - ((point - low) / span) * chart_height
            coordinates.append((px, py))
        draw.line(coordinates, fill=color, width=3)
        for px, py in coordinates:
            draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=color)
    rounded(draw, (252, 393, 1232, 676), COLORS["panel"], COLORS["line"], 8)
    text(draw, (276, 420), "Detalhe do ativo selecionado", 18, bold=True)
    detail_cards = [
        ("Temperatura", "8,9 °C", COLORS["yellow"]),
        ("Umidade", "71%", COLORS["blue"]),
        ("Compressor", "Ligado", COLORS["green"]),
        ("Última comunicação", "Agora", COLORS["cyan"]),
    ]
    for index, (label, value, color) in enumerate(detail_cards):
        x = 276 + index * 226
        rounded(draw, (x, 461, x + 204, 534), COLORS["panel_alt"], COLORS["line"], 7)
        text(draw, (x + 14, 479), label.upper(), 9, COLORS["muted"], True)
        text(draw, (x + 14, 505), value, 19, color, True)
    rounded(draw, (276, 564, 1208, 642), "#2b2814", COLORS["yellow"], 7)
    text(draw, (296, 584), "ATENÇÃO", 10, COLORS["yellow"], True)
    text(draw, (296, 611), "A ilha 03 ultrapassou a faixa configurada. A ocorrência já foi priorizada.", 15, bold=True)
    return image


def response_frame():
    """Mostra a conversao de um alerta em chamado com responsavel e historico."""
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["ink"])
    draw = ImageDraw.Draw(image)
    app_shell(draw, "Chamados")
    text(draw, (252, 98), "Resposta coordenada", 26, bold=True)
    text(draw, (252, 130), "O desvio recebe prioridade, responsável e registro de cada ação.", 14, COLORS["muted"])
    rounded(draw, (252, 170, 750, 674), COLORS["panel"], COLORS["line"], 8)
    text(draw, (276, 196), "Fila de ocorrências", 18, bold=True)
    incidents = [
        ("Temperatura acima da faixa", "Ilha refrigerada 03", "CRITICO", COLORS["red"]),
        ("Porta aberta por 12 minutos", "Câmara de resfriados", "ALTO", COLORS["orange"]),
        ("Oscilação de conectividade", "Gateway matriz", "MÉDIO", COLORS["yellow"]),
        ("Calibração preventiva", "Sensor T-018", "PLANEJADO", COLORS["blue"]),
    ]
    for index, (title, equipment, severity, color) in enumerate(incidents):
        y = 236 + index * 96
        rounded(draw, (272, y, 730, y + 78), COLORS["panel_alt"], color if index == 0 else COLORS["line"], 7)
        text(draw, (290, y + 18), title, 14, bold=True)
        text(draw, (290, y + 46), equipment, 11, COLORS["muted"])
        rounded(draw, (624, y + 22, 710, y + 52), "#132a31", color, 15)
        text(draw, (667, y + 37), severity, 9, color, True, "mm")
    rounded(draw, (774, 170, 1236, 674), COLORS["panel"], COLORS["red"], 8)
    text(draw, (798, 196), "CHAMADO TS-2048", 11, COLORS["red"], True)
    text(draw, (798, 226), "Temperatura acima da faixa", 20, bold=True)
    text(draw, (798, 261), "Ilha refrigerada 03 | Area de vendas", 12, COLORS["muted"])
    steps = [
        ("14:32", "Alerta identificado", "Leitura de 8,9 °C por 5 minutos."),
        ("14:33", "Chamado aberto", "Prioridade crítica aplicada automaticamente."),
        ("14:35", "Responsável acionado", "Equipe de manutenção confirmou atendimento."),
        ("14:42", "Ação em andamento", "Inspeção de porta e controlador."),
    ]
    for index, (time, title, detail) in enumerate(steps):
        y = 315 + index * 77
        draw.ellipse((798, y, 810, y + 12), fill=COLORS["cyan"] if index < 3 else COLORS["yellow"])
        if index < len(steps) - 1:
            draw.line((804, y + 14, 804, y + 68), fill=COLORS["line"], width=2)
        text(draw, (824, y - 3), time, 10, COLORS["muted"], True)
        text(draw, (880, y - 3), title, 13, bold=True)
        text(draw, (824, y + 25), detail, 11, COLORS["muted"])
    return image


def reports_frame():
    """Mostra como o historico vira indicador, relatorio e evidencia de auditoria."""
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["ink"])
    draw = ImageDraw.Draw(image)
    app_shell(draw, "Relatórios")
    text(draw, (252, 98), "Histórico e evidência", 26, bold=True)
    text(draw, (252, 130), "Indicadores ajudam a acompanhar desempenho, recorrência e tempo de resposta.", 14, COLORS["muted"])
    cards = [
        ("CONFORMIDADE TÉRMICA", "96,4%", COLORS["green"]),
        ("TEMPO MEDIO DE RESPOSTA", "8 min", COLORS["blue"]),
        ("OCORRÊNCIAS RESOLVIDAS", "18", COLORS["cyan"]),
    ]
    for index, (label, value, color) in enumerate(cards):
        x = 252 + index * 326
        rounded(draw, (x, 170, x + 302, 270), COLORS["panel"], COLORS["line"], 8)
        text(draw, (x + 18, 192), label, 10, COLORS["muted"], True)
        text(draw, (x + 18, 220), value, 29, color, True)
    rounded(draw, (252, 296, 865, 674), COLORS["panel"], COLORS["line"], 8)
    text(draw, (276, 322), "Conformidade por dia", 17, bold=True)
    text(draw, (276, 346), "Percentual de leituras dentro da faixa configurada", 11, COLORS["muted"])
    left, top, chart_width, chart_height = 294, 405, 530, 190
    for grid in range(5):
        y = top + grid * chart_height / 4
        draw.line((left, y, left + chart_width, y), fill=COLORS["line"], width=1)
    points = [91, 94, 93, 96, 97, 95, 98, 96]
    coordinates = []
    for index, point in enumerate(points):
        px = left + index * chart_width / (len(points) - 1)
        py = top + chart_height - ((point - 88) / 12) * chart_height
        coordinates.append((px, py))
    draw.line(coordinates, fill=COLORS["green"], width=4)
    for px, py in coordinates:
        draw.ellipse((px - 4, py - 4, px + 4, py + 4), fill=COLORS["green"])
    text(draw, (294, 630), "Relatório exportável com filtros por empresa, loja, ativo e período.", 12, COLORS["muted"])
    rounded(draw, (889, 296, 1236, 674), COLORS["panel"], COLORS["line"], 8)
    text(draw, (913, 322), "Evidencias registradas", 17, bold=True)
    evidence = [("Leituras recebidas", "12.480"), ("Alertas tratados", "18"), ("Checklists concluídos", "32"), ("Ações auditadas", "100%")]
    for index, (label, value) in enumerate(evidence):
        y = 375 + index * 66
        draw.line((913, y + 44, 1212, y + 44), fill=COLORS["line"], width=1)
        text(draw, (913, y), label, 12, COLORS["muted"])
        text(draw, (1210, y + 2), value, 16, COLORS["cyan"], True, "ra")
    rounded(draw, (913, 610, 1212, 647), COLORS["cyan"], None, 6)
    text(draw, (1062, 629), "EXPORTAR RELATÓRIO", 11, COLORS["ink"], True, "mm")
    return image


def closing_frame():
    """Fecha o video com os dois caminhos comerciais existentes na landing page."""
    image, draw = base_frame("Próximo passo", "Conheça a operação antes da implantação", "O teste gratuito usa equipamentos e telemetria virtuais, sem instalação física.")
    rounded(draw, (44, 236, 610, 570), COLORS["panel"], COLORS["cyan"], 10)
    text(draw, (76, 270), "TESTE GRATUITO", 12, COLORS["cyan"], True)
    text(draw, (76, 310), "Explore o ambiente demonstrativo", 25, bold=True)
    bullets = ["Painel operacional completo", "Equipamentos e leituras virtuais", "Roteiro para conhecer os módulos"]
    for index, bullet in enumerate(bullets):
        y = 373 + index * 46
        draw.ellipse((78, y + 3, 90, y + 15), fill=COLORS["green"])
        text(draw, (108, y + 9), bullet, 15, anchor="lm")
    rounded(draw, (76, 510, 338, 552), COLORS["cyan"], None, 6)
    text(draw, (207, 531), "INICIAR TESTE GRATUITO", 11, COLORS["ink"], True, "mm")
    rounded(draw, (642, 236, 1236, 570), COLORS["panel"], COLORS["line"], 10)
    text(draw, (674, 270), "IMPLANTAÇÃO DEFINITIVA", 12, COLORS["blue"], True)
    text(draw, (674, 310), "Leve o ThermoSync para sua operação", 25, bold=True)
    for line_index, line in enumerate(wrap(draw, "Cadastre a empresa para avaliação de escopo, plano e instalação dos equipamentos reais.", 500, 16)):
        text(draw, (674, 374 + line_index * 26), line, 16, COLORS["muted"])
    rounded(draw, (674, 510, 966, 552), "#17313a", COLORS["blue"], 6)
    text(draw, (820, 531), "SOLICITAR CONTRATAÇÃO", 11, COLORS["text"], True, "mm")
    text(draw, (640, 640), "thermosync.com.br", 18, COLORS["cyan"], True, "mm")
    return image


def timestamp(seconds):
    milliseconds = int(round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


def write_captions(durations, captions):
    """Mantem as legendas sincronizadas com a duracao declarada de cada cena."""
    cursor = 0.0
    blocks = ["WEBVTT", ""]
    for duration, caption in zip(durations, captions):
        blocks.extend([f"{timestamp(cursor)} --> {timestamp(cursor + duration)}", caption, ""])
        cursor += duration
    (PUBLIC / "thermosync-institucional.vtt").write_text("\n".join(blocks), encoding="utf-8")


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    frames = [intro_frame(), architecture_frame(), dashboard_frame(), monitoring_frame(), response_frame(), reports_frame(), closing_frame()]
    for index, image in enumerate(frames, start=1):
        save(image, index)

    durations = [7.5, 8.5, 10.0, 9.0, 9.5, 9.0, 8.0]
    captions = [
        "O ThermoSync conecta a infraestrutura refrigerada a uma operação mais previsível, rastreável e rápida para responder.",
        "Sensores e controladores enviam temperatura, umidade, energia e estado. A plataforma organiza cada leitura por empresa, loja e equipamento.",
        "No painel operacional, a equipe acompanha a saúde da frota e encontra primeiro os ativos que precisam de atenção.",
        "No monitoramento, cada equipamento mostra a leitura atual, a faixa esperada, o estado dos componentes e a tendência recente.",
        "Quando existe um desvio, o sistema prioriza a ocorrência, abre o chamado e registra responsável, horário e cada ação executada.",
        "O histórico se transforma em indicadores e relatórios para acompanhar conformidade, recorrência, tempo de resposta e auditoria.",
        "Você pode conhecer esse fluxo no teste gratuito, com equipamentos virtuais, ou solicitar uma implantação definitiva para sua empresa.",
    ]
    write_captions(durations, captions)
    frames[2].save(PUBLIC / "thermosync-video-poster.png", quality=95)


if __name__ == "__main__":
    main()
