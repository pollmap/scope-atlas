import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from entity_enrichment import indices_for,unique_reference,valid_number,official_homepage,enrich_entities
from discovery import category

class IdentityRules(unittest.TestCase):
    def test_ambiguous_and_missing_keys_never_choose_a_row(self):
        a={'corporateNumber':'1234567890123','businessNumber':'1234567890','stockCode':'0123AB'}
        index=indices_for([a,dict(a)])
        self.assertEqual(unique_reference(index['corporateNumber'],a['corporateNumber']),(None,'ambiguous'))
        self.assertEqual(unique_reference(index['businessNumber'],''),(None,'not-found'))
        self.assertEqual(valid_number('0000000000000',13),'')
        self.assertEqual(valid_number('123456-7890123',13),'1234567890123')
        self.assertEqual(unique_reference(indices_for([a])['stockCode'],'0123AB'),(a,'verified'))

    def test_homepages_reject_unsafe_schemes_credentials_and_markup(self):
        for value in ['javascript:alert(1)','file:///company.com','https://name:password@example.com','https://a.com/ bad','<script>','-']:
            self.assertEqual(official_homepage(value),'',value)
        self.assertEqual(official_homepage('www.example.com'),'https://www.example.com')
        self.assertEqual(official_homepage('https://example.com/path#old'),'https://example.com/path')

    def test_business_category_order_preserves_actual_activity(self):
        for label,expected in [('자동차 부품 도매업','commerce'),('자동차 부품 제조업','mobility'),('통신장비 제조업','electronics'),('화장품 제조업','consumer'),('의료기기 도매업','commerce'),('태양력 발전업','energy'),('금융지주회사','finance'),('지주회사','other'),('주거용 건물 개발 및 공급업','construction'),('일반 창고업','logistics'),('그 외 기타 분류 안된 운송 관련 서비스업','logistics'),('증권 중개업','finance')]:
            self.assertEqual(category(label),expected,label)

    def test_identifier_bridge_preserves_records_and_conflicting_names(self):
        def row(rid,name,sid):
            return dict(id=rid,name=name,sourceId=sid,sourceUrl='https://source.example',industrySource='',industryDate='',industry='unknown',industryLabel='',classification='unknown',classificationNote='',business='',homepage='',address='',region='',regionKind='',group='',groupBasis='',organization=sid)
        catalog=[row('large:a','같은이름','large'),row('large:b','같은이름','large'),row('middle:a','다른표기','middle'),row('listed:0123AB','공시명','listed')]
        ref=[dict(legalName='법인 A',name='공시명',corporateNumber='1234567890123',businessNumber='1234567890',stockCode='0123AB',industry='화장품 제조업',homepage='a.example',address='경기도 수원시'),dict(legalName='법인 B',name='법인 B',corporateNumber='2234567890123',businessNumber='2234567890',stockCode='',industry='경영 컨설팅업',homepage='',address='')]
        inputs={'work/normalized/scope_dart_overview_20260920.json':ref,'work/normalized/inventory_large.json':[{'name':'같은이름','corporate_id':'1234567890123'},{'name':'같은이름','corporate_id':'2234567890123'}],'work/normalized/inventory_middle.json':[{'name':'다른표기','사업자번호':'1234567890'}]}
        original=[(r['id'],r['name']) for r in catalog]
        stats,_=enrich_entities(catalog,inputs.__getitem__,{'categories':[],'groups':[]})
        self.assertEqual([(r['id'],r['name']) for r in catalog],original)
        self.assertEqual(catalog[0]['identity']['key'],catalog[2]['identity']['key'])
        self.assertEqual(catalog[0]['identity']['key'],catalog[3]['identity']['key'])
        self.assertNotEqual(catalog[0]['identity']['key'],catalog[1]['identity']['key'])
        self.assertEqual(stats['multiSourceGroups'],1)
        self.assertEqual(stats['multiSourceRows'],3)
        self.assertEqual(catalog[0]['business'],'공시 업종: 화장품 제조업')
        self.assertEqual(catalog[0]['region'],'경기도')

if __name__=='__main__':unittest.main()
