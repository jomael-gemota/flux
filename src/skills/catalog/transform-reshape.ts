import type { Skill } from '../types';

export const skill: Skill = {
    name: 'transform-reshape',
    title: 'Transform — Reshape Data',
    summary: 'Pick, rename, and reformat fields from upstream node outputs.',
    whenToUse:
        'Use when the user wants to clean up, rename, or restructure data between ' +
        'nodes — e.g. flatten a deeply-nested object, rename keys, or compose new ' +
        'fields out of expressions.',
    keywords: ['transform', 'map', 'reshape', 'rename', 'pick', 'flatten', 'compose', 'fields'],
    category: 'data',
    nodeType: 'transform',
    body: `
# Transform — Reshape Data

Builds a new output object by mapping each output key to an expression.

## Required config
- \`mappings\` (object): A flat map of \`outputFieldName → expressionString\`.

## Output
The transform node's output IS the \`mappings\` object, with each value
resolved against the workflow context. Reference downstream as
\`{{ nodes.<this-id>.output.<outputFieldName> }}\`.

## Example — extract email + summary into a clean shape
\`\`\`json
{
  "id": "transform-1",
  "type": "transform",
  "name": "Build Payload",
  "config": {
    "mappings": {
      "email":     "{{ nodes.trigger-1.output.body.from }}",
      "subject":   "{{ nodes.trigger-1.output.body.subject }}",
      "summary":   "{{ nodes.llm-1.output.content }}",
      "timestamp": "{{ nodes.trigger-1.output.triggeredAt }}"
    }
  },
  "next": []
}
\`\`\`
`,
};
