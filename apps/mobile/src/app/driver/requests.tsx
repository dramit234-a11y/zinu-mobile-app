import { useTranslation } from 'react-i18next';
import { EmptyState, Screen, Txt } from '../../components/ui';

export default function DriverRequests() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Txt variant="title" accessibilityRole="header">
        {t('driver.tabs.requests')}
      </Txt>
      <EmptyState icon="notifications" title={t('driver.requestsEmpty')} body={t('driver.requestsEmptyBody')} />
    </Screen>
  );
}
