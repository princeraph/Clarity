# StoryScope, distilled

Source: Russell, Rajendhran, Pham, Iyyer, Wieting (UMD + Google DeepMind),
"StoryScope: Investigating idiosyncrasies in AI fiction", arXiv:2604.03136v4
(13 Apr 2026). Local copy: `~/Downloads/2604.03136v4.pdf`.
Code/data: https://github.com/jenna-russell/storyscope

## What they did

- 10,272 human short stories (Books3 anthologies). Reverse-engineered a writing
  prompt from each, gave the same prompt to 5 LLMs (Claude Sonnet 4.6, GPT 5.4,
  Gemini 3 Flash, DeepSeek V3.2, Kimi K2.5). 61,608 stories, mean 4,753 words.
- Converted every story into a structured template (10 NarraBench narrative
  dimensions), compared across sources, and induced 304 interpretable narrative
  features. Assigned features to all stories, trained XGBoost, decomposed with SHAP.
- Feature assignment validated: model-human agreement kappa 0.84, higher than
  human-human agreement (0.74). Repeatability alpha 0.88-0.90.

## Headline numbers

| Result | Value |
|---|---|
| Human vs AI detection, narrative features only (257, zero style) | 93.2% macro-F1 |
| Same task, only the 30 core features | 84.8% |
| Core + 75 fingerprint features (101) | 91.1% |
| Style-only features (39) | 85.8% |
| Detection after professional stylistic rewriting (LAMP) of AI text | 93.9% (from 95.5%; -1.6) |
| 6-way authorship attribution, narrative only | 68.4% (chance 16.7%) |
| Human mean rarity percentile vs AI | 0.71 vs 0.49 (d=0.83) |
| Human-AI centroid distance vs AI-AI | 6.6 vs 4.3 (1.6x) |

Robustness checks: results unchanged after length-matching (93.2% before and after),
unchanged after removing likely-memorized stories, no significant topic effect.

Key context: surface style is fleeting. GPT 5.4 cut em-dash usage sharply;
fine-tuning to mimic human style drops stylistic AI detection from 97% to 3%
(Chakrabarty et al. 2026). Structural features require structural rewrites to remove.

## The 30 core features (Table 15), translated for content writing

Values: human vs AI. Scales are 1-5 means; percentages are prevalence.

### AI-elevated: thematic over-determination
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Thematic explicitness & moralizing | 3.28 | 3.94 | The stated takeaway; the moral |
| Moral/philosophical weighting | 3.26 | 3.68 | Everything framed as a big question |
| Thematic unity | 4.41 | 4.74 | Every example serves the thesis, no slack |
| Narrator explains the theme | 52% | 77% | "The lesson here is..." closers |
| Dialogue as philosophical debate | 34% | 59% | Quotes/dialogue used to state the point |
| References as vague implicit echoes | 50% | 72% | Alluding instead of naming |

### AI-elevated: sensory & embodied performativity
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Emotion via embodied metaphor | 38% | 81% | "My chest tightened" instead of "I was scared" |
| Setting as psychological mirror | 3.58 | 4.07 | Weather/room mood mirrors the feeling |
| Environmental/ecological emphasis | 2.83 | 3.21 | Atmosphere painting |
| Olfactory imagery | 57% | 82% | Smell details as texture filler |
| Sensory density | 3.66 | 3.93 | Lush description as default |
| Depth of interior access | 3.67 | 3.93 | Constant inner-state narration |

Counterpart human marker: **explicit emotion labels 29% vs 8%**. Humans name the
feeling. This is the single most actionable inversion of standard writing advice.

### AI-elevated: structural streamlining
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Causal chain continuity | 3.92 | 4.20 | A-to-B-to-C with no gaps |
| Spatial granularity | 2.27 | 2.53 | Over-specified scene-setting |
| Resolution via protagonist choice | 46% | 69% | Neat agency: "so I decided to..." |
| Character intro via external description | 30% | 52% | Introducing people by describing them |
| No subplots | 57% | 79% | No tangents, single track |
| Resolution via internal understanding | 27% | 47% | "And I realized..." endings |
| Opening spatial grounding | 2.12 | 2.33 | Establishing-shot openers |
| Pre-threat character investment | 2.76 | 2.99 | Dutiful setup before the conflict |

### Human-elevated: intertextual richness
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Explicit named references | 47% | 24% | Real books, people, brands, places, by name |
| Balanced explicit/implicit references | 37% | 16% | Mix of named + implied |

### Human-elevated: reader engagement
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Fourth-wall permeability | 0.67 | 0.39 | Acknowledging the text/reading situation |
| Direct reader address | 0.28 | 0.07 | "You, reading this" moments |

### Human-elevated: temporal complexity
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Recontextualization after surprise | 3.28 | 2.95 | A reveal that changes earlier material |
| Chronological discontinuity | 2.40 | 2.12 | Time jumps |
| Nonlinear framing for delayed disclosure | 1.96 | 1.68 | Withholding via structure |
| Anachrony intensity | 2.58 | 2.31 | Flashback/flash-forward weight |

### Human-elevated: narrative diversity
| Feature | Human | AI | Content translation |
|---|---|---|---|
| Location variety | 1.34 | 1.08 | More distinct settings/contexts |
| Dialogue-to-narration proportion | 2.95 | 2.70 | More quoted voice |
| Thematically parallel subplots | 42% | 21% | Tangents that echo without serving |
| Morally ambivalent protagonist | 59% | 38% | Unresolved mixed feelings |
| Explicit emotion labels | 29% | 8% | Naming the feeling |

## Model fingerprints (Table 16, top uniqueness)

- **Claude** (most distinctive; 26 fingerprints): flat event escalation, low
  event-type diversity, epilogue/flash-forward endings, avoids dream sequences,
  uncanny/haunted settings, reverent-continuist stance toward convention (62%),
  quiet endings over avalanche endings.
- **GPT** (11): gossip/rumor as plot mechanism (64%), distant retrospective
  narration ("years later..."), subverts expectations more than other AIs (41%),
  ambiguous reconciliations, ensemble casts.
- **Gemini** (11): protagonist's social network expands, primarily direct speech,
  siege/ordeal schemas, frequent flashbacks, tidiest endings, bleakest settings
  (88% tagged bleak/oppressive).
- **DeepSeek** (7): visible narrator, behavioral-cue emotions, front-loaded
  backstory, embedded storytelling scenes.
- **Kimi** (3): in-action character intros, in medias res entries; otherwise the
  generic center of the AI cluster.
- **Human** (32): character intro through dialogue, single-focal perspective,
  back-loaded revelation pacing, crossover genre ambition, visible withholding.

## Convergence and rarity (the anti-default argument)

The five AI models form one tight cluster in structural space; human writing is a
separate, more dispersed region (not a broader version of the AI cluster; even the
closest human-AI centroid pair is farther apart than the most distant AI-AI pair).
24.7% of human stories fall in the corpus's rarest 10%, vs 7.1% of AI stories. At the
prompt level the human version is the rarest of six 57.8% of the time.

Implication: the goal is never "apply the human checklist" (that builds a new
cluster); it is deliberate, varied structural choice. Rarity is the signal.

## Method insights worth stealing

1. **Template extraction**: comparing raw prose surfaced style-heavy features;
   comparing structured templates surfaced structure-heavy ones (only 6 of top-20
   overlapped). To audit structure, outline first, audit the outline.
2. **Aspect-based application**: checking one narrative dimension per pass achieved
   95.4% feature coverage vs 68.4% for a single mega-pass. Audit one dimension at a
   time.

## Caveats (be honest about these)

- The corpus is fiction, ~5,000 words, from Books3 (published authors). Short
  nonfiction transfer is an inference, not a finding.
- Direct reader address is already universal in content marketing; that feature's
  gap will not transfer at face value. The transferable version is fourth-wall
  acknowledgment of the writing itself.
- Course lessons legitimately require explicitness; calibrate per genre rather than
  banning theme statements (see genre-calibration.md).
- Some features are fiction-only (dream sequences, focalization); skip them.
