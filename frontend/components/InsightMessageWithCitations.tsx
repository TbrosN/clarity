import { InsightCitation } from '@/services/InsightService';
import { ReactNode, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'citation'; factId: string; referenceNumber: number };

const CITATION_REGEX = /\[\[cite:([a-zA-Z0-9_.-]+)\]\]/g;
const NUMBER_REGEX = /(\d+\.?\d*\s*[+]?\s*(?:\/\d+|hours?|h|%|out of \d+)?)/g;

type InsightMessageWithCitationsProps = {
  message: string;
  citations?: InsightCitation[];
  numberColor?: string;
};

const formatCitationValue = (citation: InsightCitation): string => {
  if (typeof citation.value === 'number') {
    const rounded = Number.isInteger(citation.value)
      ? citation.value.toString()
      : citation.value.toFixed(2);
    return citation.unit ? `${rounded} ${citation.unit}` : rounded;
  }
  return citation.unit ? `${citation.value} ${citation.unit}` : citation.value;
};

export default function InsightMessageWithCitations({
  message,
  citations = [],
  numberColor = '#2563EB',
}: InsightMessageWithCitationsProps) {
  const [activeFactId, setActiveFactId] = useState<string | null>(null);

  const citationByFactId = useMemo(
    () => new Map(citations.map((citation) => [citation.fact_id, citation])),
    [citations]
  );

  const { segments, orderedFactIds } = useMemo(() => {
    const output: MessageSegment[] = [];
    const encounteredFactIds: string[] = [];
    const factIdToReference = new Map<string, number>();
    CITATION_REGEX.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CITATION_REGEX.exec(message)) !== null) {
      if (match.index > lastIndex) {
        output.push({ type: 'text', text: message.slice(lastIndex, match.index) });
      }
      const factId = match[1];
      if (!factIdToReference.has(factId)) {
        const nextRef = factIdToReference.size + 1;
        factIdToReference.set(factId, nextRef);
        encounteredFactIds.push(factId);
      }
      output.push({
        type: 'citation',
        factId,
        referenceNumber: factIdToReference.get(factId)!,
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.length) {
      output.push({ type: 'text', text: message.slice(lastIndex) });
    }

    return { segments: output, orderedFactIds: encounteredFactIds };
  }, [message]);

  const activeCitation = activeFactId ? citationByFactId.get(activeFactId) ?? null : null;

  const renderTextWithHighlightedNumbers = (text: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    NUMBER_REGEX.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = NUMBER_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(<Text key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</Text>);
      }
      nodes.push(
        <Text key={`${keyPrefix}-num-${match.index}`} className="font-bold text-lg" style={{ color: numberColor }}>
          {match[0]}
        </Text>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(<Text key={`${keyPrefix}-tail-${lastIndex}`}>{text.slice(lastIndex)}</Text>);
    }

    if (nodes.length === 0) {
      nodes.push(<Text key={`${keyPrefix}-all`}>{text}</Text>);
    }

    return nodes;
  };

  return (
    <View>
      <Text className="text-gray-800 text-base leading-6">
        {segments.map((segment, idx) => {
          if (segment.type === 'text') {
            return (
              <Text key={`seg-text-${idx}`}>
                {renderTextWithHighlightedNumbers(segment.text, `seg-${idx}`)}
              </Text>
            );
          }

          const hasCitationData = citationByFactId.has(segment.factId);
          return (
            <Text
              key={`seg-cite-${idx}`}
              className={`font-semibold ${hasCitationData ? 'text-blue-700' : 'text-gray-500'}`}
              onPress={() => {
                if (!hasCitationData) return;
                setActiveFactId((current) => (current === segment.factId ? null : segment.factId));
              }}
            >
              [{segment.referenceNumber}]
            </Text>
          );
        })}
      </Text>

      {orderedFactIds.length > 0 && (
        <Text className="text-xs text-gray-500 mt-2">
          Tap a citation marker (e.g. [1]) to view source details.
        </Text>
      )}

      {activeCitation && (
        <View className="mt-3 bg-white/90 p-3 rounded-2xl border border-blue-200">
          <Text className="text-gray-800 font-semibold text-sm">{activeCitation.label}</Text>
          <Text className="text-gray-700 text-sm mt-1">
            Value: {formatCitationValue(activeCitation)} over {activeCitation.window_days} days
          </Text>
          {activeCitation.sample_size !== null && activeCitation.sample_size !== undefined && (
            <Text className="text-gray-600 text-xs mt-1">Sample size: {activeCitation.sample_size}</Text>
          )}
          {(activeCitation.n_good !== null && activeCitation.n_good !== undefined) ||
          (activeCitation.n_poor !== null && activeCitation.n_poor !== undefined) ? (
            <Text className="text-gray-600 text-xs mt-1">
              Good/Poor groups: {activeCitation.n_good ?? '-'} / {activeCitation.n_poor ?? '-'}
            </Text>
          ) : null}
          <Text className="text-gray-600 text-xs mt-2">Method: {activeCitation.method}</Text>
          <Text className="text-gray-500 text-xs mt-1">Source: {activeCitation.provenance}</Text>
        </View>
      )}
    </View>
  );
}
