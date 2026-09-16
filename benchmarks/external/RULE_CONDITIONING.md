# Rule conditioning on an external corpus

<!-- 
Each rule is measured on HelpSteer3 before anything is concluded about what it detects. The
question throughout is whether a firing rate is a behaviour or a length: a rule that fires on
long answers and short ones at the same rate is measuring something else.


## chat.auto_summary

| | |
| --- | --- |
| Corpus | HelpSteer3, Chinese rows, `preference` config only |
| Responses | 4866 |
| Firings | 390/4866 (8.01%) |
| Mean length, fired | 825 characters |
| Mean length, all | 594 characters |

### By response length

| Bucket | Firings |
| --- | --- |
| `long>=1500` | 47/381 (12.34%) |
| `medium<1500` | 149/1310 (11.37%) |
| `short<600` | 189/1911 (9.89%) |
| `xs<200` | 5/1264 (0.40%) |

### By turn count

| Turns | Firings |
| --- | --- |
| `single` | 195/2792 (6.98%) |
| `multi` | 195/2074 (9.40%) |

### By domain

| Domain | Firings |
| --- | --- |
| `multilingual` | 390/4866 (8.01%) |

### Length-matched view

The question this answers: is the rule enriched at a given length, or does it only look enriched
because it fires on long answers? A rate that holds inside every bucket is not a length effect; a
rate concentrated in the long bucket is.

| Bucket | Firings | Share of all firings |
| --- | --- | --- |
| `long>=1500` | 47/381 (12.34%) | 12% |
| `medium<1500` | 149/1310 (11.37%) | 38% |
| `short<600` | 189/1911 (9.89%) | 48% |
| `xs<200` | 5/1264 (0.40%) | 1% |

## chat.mirrors_user

| | |
| --- | --- |
| Corpus | HelpSteer3, Chinese rows, `preference` config only |
| Responses | 4866 |
| Firings | 73/4866 (1.50%) |
| Mean length, fired | 687 characters |
| Mean length, all | 594 characters |

### By response length

| Bucket | Firings |
| --- | --- |
| `long>=1500` | 5/381 (1.31%) |
| `medium<1500` | 33/1310 (2.52%) |
| `short<600` | 24/1911 (1.26%) |
| `xs<200` | 11/1264 (0.87%) |

### By turn count

| Turns | Firings |
| --- | --- |
| `single` | 53/2792 (1.90%) |
| `multi` | 20/2074 (0.96%) |

### By domain

| Domain | Firings |
| --- | --- |
| `multilingual` | 73/4866 (1.50%) |

### Length-matched view

The question this answers: is the rule enriched at a given length, or does it only look enriched
because it fires on long answers? A rate that holds inside every bucket is not a length effect; a
rate concentrated in the long bucket is.

| Bucket | Firings | Share of all firings |
| --- | --- | --- |
| `long>=1500` | 5/381 (1.31%) | 7% |
| `medium<1500` | 33/1310 (2.52%) | 45% |
| `short<600` | 24/1911 (1.26%) | 33% |
| `xs<200` | 11/1264 (0.87%) | 15% |

