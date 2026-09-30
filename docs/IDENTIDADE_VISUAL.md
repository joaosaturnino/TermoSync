# Identidade visual ThermoSync

## Conceito

A identidade representa uma rede térmica sincronizada. O sistema visual combina três estados em uma assinatura segmentada:

- **Frio**: coleta, sensores e infraestrutura refrigerada.
- **Equilíbrio**: operação estável, confirmação e ação principal.
- **Desvio**: mudança térmica, criticidade e atenção.

O símbolo reúne uma porta de expositor refrigerado e uma trilha de telemetria. Ele deve ser usado pelo componente `TermoSyncLogo`, sem recriações isoladas.

## Paleta

| Token | Cor | Uso principal |
| --- | --- | --- |
| `--brand-cold` | `#67B7FF` | telemetria, navegação e informação |
| `--brand-core` | `#42D9AE` | estabilidade, ação principal e confirmação |
| `--brand-warm` | `#FF756D` | desvio térmico e detalhe da assinatura |
| `--brand-ink` | `#071318` | fundo institucional escuro |
| `--brand-panel` | `#0B1B21` | superfícies operacionais |

Vermelho de erro, amarelo de atenção e verde de sucesso continuam semânticos. A faixa `--brand-spectrum` é uma assinatura da marca, não um indicador de severidade.

### Tokens de interface

- `--bg-color`, `--card-bg`, `--surface-base`, `--surface-raised` e
  `--surface-subtle` formam a hierarquia de fundos.
- `--text-main`, `--text-soft` e `--text-muted` formam a hierarquia de conteúdo.
- `--border` e `--border-strong` atendem divisores, controles e estados de foco.
- `--primary`, `--secondary` e `--info` orientam ações e navegação.
- `--success`, `--caution`, `--warning` e `--danger` são reservados aos estados
  verde, amarelo, laranja e vermelho, respectivamente.
- `--technical-*` atende terminais, telemetria e superfícies que precisam permanecer
  escuras nos dois temas.
- `--on-dark-text*` define a hierarquia de texto das telas públicas com fundo escuro
  fixo, como entrada, cadastro e apresentação institucional.
- `--neutral-0`, `--neutral-50`, `--neutral-100`, `--neutral-200`,
  `--neutral-300` e `--neutral-700` são a única escala fixa permitida para conteúdo
  interno de superfícies técnicas. Em telas comuns, prefira os tokens de superfície e texto.

Não declarar novamente as cores canônicas em arquivos de tela. Use o token global ou
`color-mix()` quando for necessária uma transparência específica.

### Regra de manutenção

1. Use `--surface-*`, `--text-*` e `--border*` para estrutura e conteúdo comum.
2. Use `--primary`, `--secondary` e `--info` para ações e orientação.
3. Use `--success`, `--caution`, `--warning` e `--danger` somente para o significado do estado.
4. Use `--technical-*` e `--neutral-*` apenas dentro de painéis técnicos escuros.
5. Use `--on-dark-text*` somente quando o fundo da experiência permanecer escuro em qualquer tema.
6. Antes de adicionar um hexadecimal em uma tela, verifique se um token existente atende à função.
7. Caso uma nova função de cor seja necessária, documente-a neste arquivo e declare-a em `global.css`.

## Tipografia

- **Montserrat**: única família tipográfica da plataforma, incluindo interface, títulos, ações, telemetria, protocolos, código e métricas técnicas.

Não aplicar espaçamento negativo entre letras. Conteúdo técnico pode variar peso, tamanho e cor, mas não deve substituir a família Montserrat.

## Fundos

- Todas as telas autenticadas usam `--bg-color` como canvas único.
- Landing page, login, pré-cadastro, boot e bloqueio usam `--brand-ink` no contexto institucional escuro.
- Cards e ferramentas internas podem usar `--card-bg` e `--brand-panel`, mas não devem redefinir o fundo completo da página.

## Formas e superfícies

- Controles principais usam raio de `6px` com o canto inferior direito reduzido para `2px`.
- Cards permanecem discretos, com no máximo `8px` de raio.
- A assinatura térmica pode aparecer como uma linha de `2px` ou `3px` em áreas de identidade e navegação.
- Evitar brilho neon, scanlines, grandes gradientes atmosféricos e elementos decorativos sem função.

## Fotografia

Priorizar expositores refrigerados, câmaras, produtos e ambientes reais da cadeia fria. As imagens devem mostrar o objeto monitorado com clareza, sem equipamentos genéricos de data center, efeitos futuristas ou infraestrutura técnica dominando a cena.

## Interface

- Azul-frio orienta e informa.
- Verde de equilíbrio confirma e conduz a ação principal.
- Coral térmico marca alteração, limite ou detalhe proprietário.
- O trio completo aparece apenas na marca e na assinatura térmica.
- Novas telas devem consumir os tokens globais em `frontend/src/styles/global.css` em vez de adicionar cores de marca diretamente.
