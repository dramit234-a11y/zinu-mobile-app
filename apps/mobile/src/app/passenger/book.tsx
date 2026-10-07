import { useTranslation } from 'react-i18next';
import { EmptyState, Screen } from '../../components/ui';

export default function Book() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <EmptyState icon="car-sport" title={t('passenger.bookTitle')} body={t('passenger.bookBody')} />
    </Screen>
  );
}
