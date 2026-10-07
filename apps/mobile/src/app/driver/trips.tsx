import { useTranslation } from 'react-i18next';
import { EmptyState, Screen, Txt } from '../../components/ui';

export default function DriverTrips() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Txt variant="title" accessibilityRole="header">
        {t('driver.tabs.trips')}
      </Txt>
      <EmptyState icon="time" title={t('driver.tripsEmpty')} body={t('driver.requestsEmptyBody')} />
    </Screen>
  );
}
