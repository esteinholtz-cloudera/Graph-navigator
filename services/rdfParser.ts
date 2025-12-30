
import { GraphData, GraphNode, GraphLink } from '../types';

export const parseInputToGraph = (input: string, format: 'rdf' | 'json'): GraphData => {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const extraAttributes = new Set<string>();
  let parseError: string | undefined;

  if (!input.trim()) {
    return { nodes: [], links: [], extraAttributes: [] };
  }

  const structuralKeys = [
    '@id', 'id', 'subject', 's',
    'predicate', 'p', 'predicate_id',
    'object', 'o', 'target',
    '@type', 'type', 'label', 'name'
  ];

  /**
   * Extracts a short label from a URI or prefixed name.
   */
  const getShortLabel = (id: string): string => {
    if (id === 'a') return 'type';
    const parts = id.split(/[\/#:]/);
    const last = parts.pop();
    return last || id;
  };

  const addNode = (id: string, label?: string, metadata?: Record<string, any>) => {
    if (!id) return;
    const existing = nodesMap.get(id);
    const defaultLabel = getShortLabel(id);
    
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

  const isXml = input.trim().startsWith('<?xml') || input.trim().startsWith('<rdf:RDF');

  if (format === 'json') {
    try {
      const data = JSON.parse(input);
      const items = Array.isArray(data) ? data : [data];
      
      items.forEach((item: any) => {
        let s, p, o, metadata: Record<string, any> = {};

        if (Array.isArray(item) && item.length >= 3) {
          s = item[0]; p = item[1]; o = item[2];
        } else if (typeof item === 'object') {
          s = item.subject || item.s || item['@id'] || item['id'];
          p = item.predicate || item.p || item.predicate_id;
          o = item.object || item.o || item.target;

          Object.entries(item).forEach(([key, value]) => {
            if (!structuralKeys.includes(key)) {
              metadata[key] = value;
              extraAttributes.add(key);
            }
          });
        }

        if (s && p && o) {
          addNode(String(s), undefined, metadata);
          addNode(String(o), undefined, metadata);
          links.push({
            source: String(s),
            target: String(o),
            label: getShortLabel(String(p)),
            uri: String(p),
            metadata: metadata
          });
        }
      });
    } catch (e: any) {
      parseError = `JSON Syntax Error: ${e.message}`;
    }
  } else if (isXml) {
    try {
      // Manual entity resolution for DTDs since standard DOMParser ignores them
      let resolvedInput = input;
      const entityRegex = /<!ENTITY\s+(\w+)\s+['"]([^'"]+)['"]\s*>/g;
      const entities: Record<string, string> = {};
      let match;
      while ((match = entityRegex.exec(input)) !== null) {
        entities[match[1]] = match[2];
      }
      
      // Replace entities like &wn20instances; with their values
      Object.entries(entities).forEach(([name, value]) => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const r = new RegExp(`&${escapedName};`, 'g');
        resolvedInput = resolvedInput.replace(r, value);
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(resolvedInput, "text/xml");
      const errorNode = doc.querySelector("parsererror");
      if (errorNode) throw new Error(errorNode.textContent || "XML Parsing Error");

      const descriptions = doc.getElementsByTagNameNS("*", "Description");
      let matchedTriples = 0;

      for (let i = 0; i < descriptions.length; i++) {
        const desc = descriptions[i];
        const subject = desc.getAttributeNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "about") || 
                        desc.getAttribute("rdf:about") ||
                        desc.getAttributeNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "ID") ||
                        desc.getAttribute("rdf:ID");
        
        if (!subject) continue;

        const children = desc.children;
        for (let j = 0; j < children.length; j++) {
          const predNode = children[j];
          const predicate = predNode.tagName;
          const object = predNode.getAttributeNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "resource") ||
                         predNode.getAttribute("rdf:resource") ||
                         predNode.textContent?.trim();

          if (predicate && object) {
            matchedTriples++;
            addNode(subject);
            addNode(object);
            links.push({
              source: subject,
              target: object,
              label: getShortLabel(predicate),
              uri: predicate
            });
          }
        }
      }

      if (matchedTriples === 0) {
        parseError = "XML parsed but no rdf:Description triples were found.";
      }
    } catch (e: any) {
      parseError = `RDF/XML Error: ${e.message}`;
    }
  } else {
    // NTriples / Turtle fallback
    const lines = input.split('\n');
    let matchedLines = 0;
    const tripleRegex = /^\s*(<[^>]+>|[^\s<>]+)\s+(<[^>]+>|[^\s<>]+)\s+(<[^>]+>|".*?"|[^\s<>]+?)(?:\s*\.|\s*$)/;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@prefix') || trimmed.startsWith('@base') || trimmed.startsWith('PREFIX') || trimmed.startsWith('BASE')) return;

      const match = trimmed.match(tripleRegex);
      if (match) {
        matchedLines++;
        const s = match[1].replace(/[<>]/g, '').trim();
        const p = match[2].replace(/[<>]/g, '').trim();
        const o = match[3].replace(/[<>]/g, '').replace(/^"(.*)"$/, '$1').trim();

        addNode(s);
        addNode(o);
        links.push({
          source: s,
          target: o,
          label: getShortLabel(p),
          uri: p
        });
      }
    });

    if (matchedLines === 0 && input.trim().length > 0) {
      parseError = "No valid RDF triples found. Check format.";
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links,
    extraAttributes: Array.from(extraAttributes),
    error: parseError
  };
};

export const sampleRDF = `
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE rdf:RDF [
    <!ENTITY rdf 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
    <!ENTITY rdfs 'http://www.w3.org/2000/01/rdf-schema#'>
    <!ENTITY wn20instances 'http://www.w3.org/2006/03/wn/wn20/instances/'>
    <!ENTITY wn20schema 'http://www.w3.org/2006/03/wn/wn20/schema/'>
]>

<rdf:RDF
    xmlns:rdf="&rdf;"
    xmlns:rdfs="&rdfs;"
    xmlns:wn20instances="&wn20instances;"
    xmlns:wn20schema="&wn20schema;"
    xml:lang="en-US">
<rdf:Description rdf:about="&wn20instances;synset-cause_to_sleep-verb-1">
  <wn20schema:causes rdf:resource="&wn20instances;synset-sleep-verb-1"/>
</rdf:Description>

<rdf:Description rdf:about="&wn20instances;synset-keep_up-verb-5">
  <wn20schema:causes rdf:resource="&wn20instances;synset-stay_up-verb-1"/>
</rdf:Description>

<rdf:Description rdf:about="&wn20instances;synset-anesthetize-verb-1">
  <wn20schema:causes rdf:resource="&wn20instances;synset-sleep-verb-1"/>
</rdf:Description>
</rdf:RDF>
`;

export const sampleJSON = `
[
  ["ex:Alice", "ex:knows", "ex:Bob"],
  {
    "s": "ex:Bob",
    "p": "ex:worksFor",
    "o": "ex:CompanyX",
    "strength": 0.9
  }
]
`;
