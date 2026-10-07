import { useTranslation } from 'react-i18next';
import { docState, type DocEntry } from '../lib/registration';
import { Badge } from './ui';

export function DocBadge({ entry }: { entry: DocEntry }) {
  const { t } = useTranslation();
  const state = docState(entry);
  const tone = state === 'APPROVED' ? 'primary' : state === 'REJECTED' || state === 'EXPIRED' ? 'danger' : 'accent';
  return <Badge label={t(`reg.docStatus.${state}`)} tone={tone} />;
}
