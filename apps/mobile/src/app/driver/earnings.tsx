import { useTranslation } from 'react-i18next';
import { EmptyState, Screen, Txt } from '../../components/ui';

export default function DriverEarnings() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Txt variant="title" accessibilityRole="header">
        {t('driver.tabs.earnings')}
      </Txt>
      <EmptyState icon="cash" title={t('driver.earningsEmpty')} body={t('driver.earningsEmptyBody')} />
    </Screen>
  );
}
