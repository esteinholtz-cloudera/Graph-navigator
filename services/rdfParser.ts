
import { GraphData, GraphNode, GraphLink } from '../types';

export const parseInputToGraph = (input: string, format: 'rdf' | 'json'): GraphData => {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const extraAttributes = new Set<string>();

  const structuralKeys = [
    '@id', 'id', 'subject', 's',
    'predicate', 'p', 'predicate_id',
    'object', 'o', 'target',
    '@type', 'type', 'label', 'name'
  ];

  const addNode = (id: string, label?: string, metadata?: Record<string, any>) => {
    const existing = nodesMap.get(id);
    // Use : as well as / and # to extract the local name for the label
    const defaultLabel = id.split(/[\/#:]/).pop() || id;
    
    const newNode: GraphNode = {
      id,
      label: label || existing?.label || defaultLabel,
      type: id.startsWith('http') ? 'Resource' : 'Literal',
      metadata: { ...(existing?.metadata || {}), ...(metadata || {}) }
    };
    nodesMap.set(id, newNode);
    
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        if (!structuralKeys.includes(key)) {
          extraAttributes.add(key);
        }
      });
    }
  };

  if (format === 'json') {
    try {
      const data = JSON.parse(input);
      const items = Array.isArray(data) ? data : [data];
      
      items.forEach((item: any) => {
        const s = item.subject || item.s || item['@id'] || item['id'];
        const p = item.predicate || item.p || item.predicate_id;
        const o = item.object || item.o || item.target;

        if (s && p && o) {
          const metadata: Record<string, any> = {};
          Object.entries(item).forEach(([key, value]) => {
            if (!structuralKeys.includes(key)) {
              metadata[key] = value;
              extraAttributes.add(key);
            }
          });
          
          addNode(String(s), undefined, metadata);
          addNode(String(o), undefined, metadata);
          
          links.push({
            source: String(s),
            target: String(o),
            label: String(p).split(/[\/#:]/).pop() || String(p),
            uri: String(p),
            metadata: metadata
          });
        } else {
          const subjectId = item['@id'] || item['id'] || 'unknown';
          const itemMetadata: Record<string, any> = {};
          
          Object.entries(item).forEach(([key, value]) => {
            if (!structuralKeys.includes(key)) {
              itemMetadata[key] = value;
            }
          });

          addNode(subjectId, item['label'] || item['name'], itemMetadata);

          Object.entries(item).forEach(([predicate, value]) => {
            if (structuralKeys.includes(predicate)) return;

            const values = Array.isArray(value) ? value : [value];
            values.forEach((v: any) => {
              let targetId = '';
              let targetLabel = '';
              let targetMetadata: Record<string, any> = {};

              if (typeof v === 'string') {
                targetId = v;
              } else if (v && typeof v === 'object') {
                targetId = v['@id'] || v['id'] || JSON.stringify(v);
                targetLabel = v['label'] || v['name'] || '';
                Object.keys(v).forEach(k => {
                  if (!structuralKeys.includes(k)) {
                    targetMetadata[k] = v[k];
                    extraAttributes.add(k);
                  }
                });
              }

              if (targetId) {
                addNode(targetId, targetLabel, targetMetadata);
                links.push({
                  source: subjectId,
                  target: targetId,
                  label: predicate.split(/[\/#:]/).pop() || predicate,
                  uri: predicate
                });
              }
            });
          });
        }
      });
    } catch (e) {
      console.error('JSON Parse error', e);
    }
  } else {
    const lines = input.split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*(<[^>]+>|[\w-]+:[\w-]+)\s+(<[^>]+>|[\w-]+:[\w-]+)\s+(<[^>]+>|[\w-]+:[\w-]+|".*?")\s*\.?/);
      if (match) {
        const [_, s, p, o] = match;
        const subjId = s.replace(/[<>]/g, '');
        const predId = p.replace(/[<>]/g, '');
        const objId = o.replace(/[<>]/g, '').replace(/"/g, '');

        addNode(subjId);
        addNode(objId);
        links.push({
          source: subjId,
          target: objId,
          label: predId.split(/[\/#:]/).pop() || predId,
          uri: predId
        });
      }
    });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links,
    extraAttributes: Array.from(extraAttributes)
  };
};

export const sampleRDF = `
<http://example.org/Alice> <http://schema.org/name> "Alice" .
<http://example.org/Alice> <http://schema.org/knows> <http://example.org/Bob> .
<http://example.org/Bob> <http://schema.org/name> "Bob" .
<http://example.org/Bob> <http://schema.org/worksFor> <http://example.org/CompanyX> .
<http://example.org/Alice> <http://schema.org/worksFor> <http://example.org/CompanyX> .
<http://example.org/CompanyX> <http://schema.org/name> "Tech Corp" .
`;

export const sampleJSON = `
[
  {
    "subject": "http://example.org/Alice",
    "predicate": "http://schema.org/knows",
    "object": "http://example.org/Bob",
    "community_id": "Alpha",
    "is_derived": true
  },
  {
    "subject": "http://example.org/Bob",
    "predicate": "http://schema.org/worksFor",
    "object": "http://example.org/CompanyX",
    "community_id": "Beta"
  }
]
`;
